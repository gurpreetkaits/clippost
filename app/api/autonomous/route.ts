import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authenticateApiKey } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isValidYouTubeUrl, downloadVideo, getVideoPath } from "@/lib/youtube";
import { extractFullAudio, createClipWithCaptions, cleanup, CaptionSegment } from "@/lib/ffmpeg";
import { splitLongSegments } from "@/lib/whisper";
import { transcribeFullAudioSarvam } from "@/lib/sarvam";
import { findBestSegment, filterCaptionsForRange, generateCaption, OpenAIRateLimitError as AIRateLimitError } from "@/lib/ai";
import { getCachedTranscription, cacheTranscription } from "@/lib/transcription-cache";
import { checkUsageLimit } from "@/lib/usage";
import { getDefaultAccount, refreshTokenIfNeeded } from "@/lib/accounts";
import {
  createReelContainer,
  waitForContainerReady,
  publishReel,
} from "@/lib/instagram";
import { ensureFreshToken, uploadToYouTubeShorts } from "@/lib/youtube-api";
import { VideoLayout } from "@/lib/video-layout";
import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";

async function uploadToTmpFiles(filePath: string): Promise<string> {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));

  const response = await axios.post("https://tmpfiles.org/api/v1/upload", form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  const url = response.data.data.url as string;
  return url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
}

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  // Try API key auth first, then session auth
  let userId: string;
  const apiKeyAuth = await authenticateApiKey(request);
  if (apiKeyAuth) {
    userId = apiKeyAuth.userId;
  } else {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = authResult.userId;
  }

  let body: { url: string; purpose?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { url, purpose } = body;

  if (!url || !isValidYouTubeUrl(url)) {
    return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
  }

  // Usage check disabled for local development
  // const usageCheck = await checkUsageLimit(userId, "CLIP_CREATED");
  // if (!usageCheck.allowed) {
  //   return NextResponse.json(
  //     { error: `Clip limit reached (${usageCheck.used}/${usageCheck.limit} this month).` },
  //     { status: 403 }
  //   );
  // }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(sseEvent(data)));
      }

      function progress(step: string, message: string, percent: number) {
        send({ type: "progress", step, message, percent });
      }

      let audioPath: string | null = null;

      try {
        // Load user preferences
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            defaultLanguage: true,
            defaultFormat: true,
            defaultFrame: true,
            autoPostInstagram: true,
            autoPostYoutube: true,
            useAiCaptions: true,
          },
        });

        const language = user?.defaultLanguage || "en";
        const layout: VideoLayout = {
          format: (user?.defaultFormat as "original" | "9:16") || "original",
          frame: (user?.defaultFrame as "fill" | "cinema" | "compact" | "floating") || "cinema",
        };

        // Step 1: Download video
        progress("downloading", "Downloading video...", 5);
        const metadata = await downloadVideo(userId, url);
        const videoPath = getVideoPath(userId, metadata.filename);
        progress("downloading", "Video downloaded", 15);

        // Upsert video record
        const video = await prisma.video.upsert({
          where: { userId_youtubeId: { userId, youtubeId: metadata.id } },
          update: { title: metadata.title, filename: metadata.filename },
          create: {
            userId,
            youtubeId: metadata.id,
            title: metadata.title,
            duration: metadata.duration,
            filename: metadata.filename,
            sourceUrl: url,
          },
        });

        // Step 2: Check for cached transcription on disk
        let segments: CaptionSegment[];
        const cached = getCachedTranscription(userId, metadata.id, language);

        if (cached) {
          progress("transcribing", "Using cached transcription...", 27);
          segments = cached;
          progress("transcribing", "Transcription loaded from cache", 50);
        } else {
          // Need to transcribe
          progress("extracting_audio", "Extracting audio track...", 17);
          audioPath = await extractFullAudio(userId, videoPath);
          progress("extracting_audio", "Audio extracted", 25);

          progress("transcribing", "Transcribing audio with Sarvam AI...", 27);
          const transcribeProgress = (chunkPercent: number) => {
            const scaled = 25 + Math.round((chunkPercent / 100) * 25);
            progress("transcribing", "Transcribing audio with Sarvam AI...", scaled);
          };

          segments = await transcribeFullAudioSarvam(audioPath, language, transcribeProgress);
          progress("transcribing", "Transcription complete", 50);

          // Cache transcription to disk for reuse
          cacheTranscription(userId, metadata.id, language, segments);
        }

        // Step 4: AI picks best segment with fallback to simple heuristic
        progress("analyzing", "Finding best segment...", 52);
        let bestSegment;
        let usedAIFallback = false;

        try {
          bestSegment = await findBestSegment(
            segments,
            purpose || undefined,
            metadata.duration
          );
        } catch (error) {
          if (error instanceof AIRateLimitError) {
            // OpenAI rate limit for AI selection - use simple heuristic
            console.log("OpenAI rate limit for AI selection, using heuristic fallback");
            progress("analyzing", "OpenAI limit reached, using heuristic selection...", 55);
            usedAIFallback = true;

            // Simple heuristic: find longest continuous speech block (15-60s)
            const speechBlocks: Array<{ start: number; end: number; duration: number }> = [];
            let currentBlock = { start: segments[0]?.start || 0, end: segments[0]?.end || 0 };

            for (let i = 1; i < segments.length; i++) {
              const gap = segments[i].start - currentBlock.end;
              if (gap <= 2) {
                currentBlock.end = segments[i].end;
              } else {
                const duration = currentBlock.end - currentBlock.start;
                if (duration >= 15 && duration <= 60) {
                  speechBlocks.push({ ...currentBlock, duration });
                }
                currentBlock = { start: segments[i].start, end: segments[i].end };
              }
            }

            // Add last block
            const lastDuration = currentBlock.end - currentBlock.start;
            if (lastDuration >= 15 && lastDuration <= 60) {
              speechBlocks.push({ ...currentBlock, duration: lastDuration });
            }

            // Pick the longest block, or first 30s if no good block found
            if (speechBlocks.length > 0) {
              const longest = speechBlocks.reduce((a, b) => a.duration > b.duration ? a : b);
              bestSegment = {
                start: longest.start,
                end: longest.end,
                reason: "Selected using heuristic fallback (longest continuous speech)",
              };
            } else {
              // Fallback: use first 30 seconds
              bestSegment = {
                start: 0,
                end: Math.min(30, metadata.duration),
                reason: "Selected using heuristic fallback (first 30 seconds)",
              };
            }
          } else {
            throw error;
          }
        }

        progress("analyzing", `Found: ${bestSegment.reason}`, 60);

        // Step 5: Generate clip with captions + user layout
        progress("generating_clip", "Generating clip with captions...", 62);
        const captionsInRange = filterCaptionsForRange(
          segments,
          bestSegment.start,
          bestSegment.end
        );
        const shortCaptions = splitLongSegments(captionsInRange);
        const clipFilename = await createClipWithCaptions(
          userId,
          videoPath,
          bestSegment.start,
          bestSegment.end,
          shortCaptions,
          undefined, // default caption style
          layout
        );
        progress("generating_clip", "Clip generated", 75);

        // Track clip in DB
        const clip = await prisma.clip.create({
          data: {
            userId,
            videoId: video.id,
            filename: clipFilename,
            startTime: bestSegment.start,
            endTime: bestSegment.end,
            duration: bestSegment.end - bestSegment.start,
            hasCaptions: true,
            method: "AUTO_TRIM",
          },
        });

        await prisma.usageRecord.create({
          data: {
            userId,
            action: "CLIP_CREATED",
            metadata: { filename: clipFilename, method: "AUTONOMOUS" },
          },
        });

        const results: Record<string, unknown> = {
          clipFilename,
          start: bestSegment.start,
          end: bestSegment.end,
          segmentReason: bestSegment.reason,
          title: metadata.title,
        };

        // Step 6: Auto-publish to Instagram
        if (user?.autoPostInstagram) {
          progress("publishing_instagram", "Publishing to Instagram...", 77);
          try {
            console.log('[DEBUG] Getting Instagram account for userId:', userId);
            const igAccount = await getDefaultAccount(userId);
            console.log('[DEBUG] Instagram account found:', igAccount ? igAccount.username : 'null');
            if (igAccount) {
              const refreshed = await refreshTokenIfNeeded(userId, igAccount);
              const credentials = {
                accessToken: refreshed.accessToken,
                accountId: refreshed.id,
              };

              const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
              const clipPath = path.join(
                process.cwd(),
                "tmp",
                safeUserId,
                path.basename(clipFilename)
              );

              const caption = user.useAiCaptions
                ? await generateCaption(metadata.title, bestSegment.end - bestSegment.start, "instagram")
                : "";

              const publicUrl = await uploadToTmpFiles(clipPath);
              const containerId = await createReelContainer(credentials, publicUrl, caption);
              await waitForContainerReady(credentials, containerId);
              const mediaId = await publishReel(credentials, containerId);

              await prisma.clip.update({
                where: { id: clip.id },
                data: { publishedAt: new Date(), instagramMediaId: mediaId },
              });
              await prisma.usageRecord.create({
                data: {
                  userId,
                  action: "PUBLISH",
                  metadata: { clipFilename, mediaId, platform: "instagram" },
                },
              });

              results.instagram = { success: true, mediaId };
              progress("publishing_instagram", "Published to Instagram", 85);
            } else {
              results.instagram = { success: false, reason: "No Instagram account connected" };
            }
          } catch (err) {
            results.instagram = {
              success: false,
              reason: err instanceof Error ? err.message : "Instagram publish failed",
            };
            progress("publishing_instagram", "Instagram publish failed", 85);
          }
        }

        // Step 7: Auto-publish to YouTube
        if (user?.autoPostYoutube) {
          progress("publishing_youtube", "Publishing to YouTube Shorts...", 87);
          try {
            const ytChannel = await prisma.youTubeChannel.findFirst({
              where: { userId, isDefault: true },
            });
            const channel = ytChannel || await prisma.youTubeChannel.findFirst({
              where: { userId },
              orderBy: { connectedAt: "asc" },
            });

            if (channel) {
              const accessToken = await ensureFreshToken(userId, channel.channelId);

              const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
              const clipPath = path.join(
                process.cwd(),
                "tmp",
                safeUserId,
                path.basename(clipFilename)
              );

              const shortTitle = `${metadata.title} #Shorts`;
              const shortDesc = user.useAiCaptions
                ? await generateCaption(metadata.title, bestSegment.end - bestSegment.start, "youtube")
                : "";

              const videoId = await uploadToYouTubeShorts(
                accessToken,
                clipPath,
                shortTitle,
                shortDesc
              );

              await prisma.clip.update({
                where: { id: clip.id },
                data: { youtubeVideoId: videoId },
              });
              await prisma.usageRecord.create({
                data: {
                  userId,
                  action: "PUBLISH",
                  metadata: { clipFilename, youtubeVideoId: videoId, platform: "youtube" },
                },
              });

              results.youtube = {
                success: true,
                videoId,
                url: `https://youtube.com/shorts/${videoId}`,
              };
              progress("publishing_youtube", "Published to YouTube", 95);
            } else {
              results.youtube = { success: false, reason: "No YouTube channel connected" };
            }
          } catch (err) {
            results.youtube = {
              success: false,
              reason: err instanceof Error ? err.message : "YouTube publish failed",
            };
            progress("publishing_youtube", "YouTube publish failed", 95);
          }
        }

        // Done
        send({ type: "done", percent: 100, ...results });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Autonomous pipeline failed",
        });
      } finally {
        if (audioPath) cleanup(audioPath);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
