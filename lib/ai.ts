import OpenAI from "openai";
import { CaptionSegment } from "./ffmpeg";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class OpenAIRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAIRateLimitError";
  }
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("rate limit") ||
      message.includes("429") ||
      message.includes("quota") ||
      message.includes("too many requests")
    );
  }
  return false;
}

export interface SegmentResult {
  start: number;
  end: number;
  reason: string;
}

interface SilenceGap {
  start: number;
  end: number;
  duration: number;
}

/**
 * Detect silence gaps between transcription segments.
 * A gap is considered significant if it's > 2 seconds.
 */
function detectSilenceGaps(segments: CaptionSegment[], threshold = 2): SilenceGap[] {
  const gaps: SilenceGap[] = [];

  for (let i = 0; i < segments.length - 1; i++) {
    const currentEnd = segments[i].end;
    const nextStart = segments[i + 1].start;
    const gapDuration = nextStart - currentEnd;

    if (gapDuration > threshold) {
      gaps.push({
        start: currentEnd,
        end: nextStart,
        duration: gapDuration,
      });
    }
  }

  return gaps;
}

/**
 * Calculate the total silence duration within a given time range.
 */
function calculateSilenceInRange(
  gaps: SilenceGap[],
  rangeStart: number,
  rangeEnd: number
): number {
  let totalSilence = 0;

  for (const gap of gaps) {
    // Check if gap overlaps with the range
    if (gap.end <= rangeStart || gap.start >= rangeEnd) continue;

    const overlapStart = Math.max(gap.start, rangeStart);
    const overlapEnd = Math.min(gap.end, rangeEnd);
    totalSilence += overlapEnd - overlapStart;
  }

  return totalSilence;
}

/**
 * Adjust segment boundaries to minimize silence at the start and end.
 */
function trimSilenceFromBoundaries(
  start: number,
  end: number,
  segments: CaptionSegment[]
): { start: number; end: number } {
  // Find first segment that overlaps with the start
  const firstSegment = segments.find(s => s.end > start);
  const lastSegment = segments.reverse().find(s => s.start < end);
  segments.reverse(); // restore original order

  if (!firstSegment || !lastSegment) {
    return { start, end };
  }

  // Adjust start to the beginning of the first actual speech
  const adjustedStart = Math.max(start, firstSegment.start);

  // Adjust end to the end of the last actual speech
  const adjustedEnd = Math.min(end, lastSegment.end);

  return { start: adjustedStart, end: adjustedEnd };
}

export async function findBestSegment(
  segments: CaptionSegment[],
  purpose: string | undefined,
  videoDuration: number
): Promise<SegmentResult> {
  // For short videos (≤40s), return the full range trimmed to actual speech
  if (videoDuration <= 40) {
    const trimmed = trimSilenceFromBoundaries(0, videoDuration, segments);
    return {
      start: trimmed.start,
      end: trimmed.end,
      reason: "Video is short enough to use in full.",
    };
  }

  // Detect silence gaps in the transcript
  const silenceGaps = detectSilenceGaps(segments);

  // Build timestamped transcript for GPT with silence indicators
  let transcript = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    transcript += `[${formatTime(seg.start)} - ${formatTime(seg.end)}] ${seg.text}\n`;

    // Add silence indicators for gaps > 2 seconds
    if (i < segments.length - 1) {
      const nextSeg = segments[i + 1];
      const gapDuration = nextSeg.start - seg.end;
      if (gapDuration > 2) {
        transcript += `[SILENCE: ${gapDuration.toFixed(1)}s]\n`;
      }
    }
  }

  const systemPrompt = purpose
    ? `You are a video editor AI. Given a timestamped transcript and a user's purpose, find the single best continuous segment (15-60 seconds) that matches the purpose. The video is ${videoDuration} seconds long.

CRITICAL: The selected segment must NOT contain significant silence gaps. Look for continuous speech without [SILENCE] markers, or only brief pauses (< 2s). The clip should be engaging from start to finish with minimal dead air.

Return JSON with exactly these fields:
- "start": number (seconds, must be >= 0)
- "end": number (seconds, must be <= ${videoDuration})
- "reason": string (1-2 sentence explanation of why this segment was chosen)

The segment duration (end - start) must be between 15 and 60 seconds. Pick the most compelling, self-contained segment with continuous speech.`
    : `You are a video editor AI. Find the single most compelling, viral-worthy continuous segment (15-60 seconds) from this transcript. The video is ${videoDuration} seconds long.

CRITICAL: The selected segment must NOT contain significant silence gaps. Look for continuous speech without [SILENCE] markers, or only brief pauses (< 2s). The clip should be engaging from start to finish with minimal dead air.

Pick the part with the strongest hook, highest entertainment value, or most useful information. Prefer segments that start with an attention-grabbing moment and maintain energy throughout.

Return JSON with exactly these fields:
- "start": number (seconds, must be >= 0)
- "end": number (seconds, must be <= ${videoDuration})
- "reason": string (1-2 sentence explanation of why this segment was chosen)

The segment duration (end - start) must be between 15 and 60 seconds.`;

  let response;
  try {
    response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `${purpose ? `Purpose: ${purpose}\n\n` : ""}Transcript:\n${transcript}`,
        },
      ],
    });
  } catch (error) {
    if (isRateLimitError(error)) {
      throw new OpenAIRateLimitError(
        error instanceof Error ? error.message : "OpenAI rate limit exceeded"
      );
    }
    throw error;
  }

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("GPT returned empty response");
  }

  let result = JSON.parse(content) as SegmentResult;

  // Clamp to valid range
  result.start = Math.max(0, result.start);
  result.end = Math.min(videoDuration, result.end);

  // Trim silence from the boundaries
  const trimmed = trimSilenceFromBoundaries(result.start, result.end, segments);
  result.start = trimmed.start;
  result.end = trimmed.end;

  // Calculate silence ratio in the selected segment
  const segmentDuration = result.end - result.start;
  const silenceDuration = calculateSilenceInRange(silenceGaps, result.start, result.end);
  const silenceRatio = silenceDuration / segmentDuration;

  // If the segment has too much silence (>30%), try to adjust
  if (silenceRatio > 0.3) {
    // Find the longest continuous speech block within the original range
    const speechBlocks = findContinuousSpeechBlocks(segments, result.start, result.end);
    if (speechBlocks.length > 0) {
      // Use the longest speech block
      const longest = speechBlocks.reduce((a, b) =>
        (b.end - b.start) > (a.end - a.start) ? b : a
      );
      result.start = longest.start;
      result.end = longest.end;
    }
  }

  // Ensure minimum duration
  if (result.end - result.start < 5) {
    result.end = Math.min(videoDuration, result.start + 15);
  }

  return result;
}

/**
 * Find continuous blocks of speech (no gaps > 2s) within a time range.
 */
function findContinuousSpeechBlocks(
  segments: CaptionSegment[],
  rangeStart: number,
  rangeEnd: number
): Array<{ start: number; end: number }> {
  const blocks: Array<{ start: number; end: number }> = [];
  let currentBlock: { start: number; end: number } | null = null;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // Skip segments outside the range
    if (seg.end <= rangeStart || seg.start >= rangeEnd) continue;

    const segStart = Math.max(seg.start, rangeStart);
    const segEnd = Math.min(seg.end, rangeEnd);

    if (!currentBlock) {
      currentBlock = { start: segStart, end: segEnd };
    } else {
      const gap = segStart - currentBlock.end;
      if (gap <= 2) {
        // Extend current block
        currentBlock.end = segEnd;
      } else {
        // Gap too large, save current block and start new one
        if (currentBlock.end - currentBlock.start >= 10) {
          blocks.push(currentBlock);
        }
        currentBlock = { start: segStart, end: segEnd };
      }
    }
  }

  // Don't forget the last block
  if (currentBlock && currentBlock.end - currentBlock.start >= 10) {
    blocks.push(currentBlock);
  }

  return blocks;
}

export function filterCaptionsForRange(
  segments: CaptionSegment[],
  start: number,
  end: number
): CaptionSegment[] {
  const filtered: CaptionSegment[] = [];

  for (const seg of segments) {
    // Skip segments entirely outside the range
    if (seg.end <= start || seg.start >= end) continue;

    // Clamp segment timestamps
    const clampedStart = Math.max(seg.start, start);
    const clampedEnd = Math.min(seg.end, end);

    const clampedSeg: CaptionSegment = {
      start: clampedStart,
      end: clampedEnd,
      text: seg.text,
    };

    // Filter and clamp word-level timestamps if present
    if (seg.words && seg.words.length > 0) {
      clampedSeg.words = seg.words
        .filter((w) => w.end > start && w.start < end)
        .map((w) => ({
          word: w.word,
          start: Math.max(w.start, start),
          end: Math.min(w.end, end),
        }));

      if (clampedSeg.words.length > 0) {
        clampedSeg.text = clampedSeg.words.map((w) => w.word).join(" ");
      }
    }

    filtered.push(clampedSeg);
  }

  return filtered;
}

export async function generateCaption(
  videoTitle: string,
  clipDuration: number,
  platform: "instagram" | "youtube"
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are a social media content creator. Generate a short, engaging ${platform === "instagram" ? "Instagram Reel" : "YouTube Shorts"} caption/description for a video clip. Include 3-5 relevant hashtags at the end. Keep it under 150 characters (excluding hashtags). Be catchy and use the video title as context. Do not use emojis excessively.`,
        },
        {
          role: "user",
          content: `Video: "${videoTitle}" (${Math.round(clipDuration)}s clip)`,
        },
      ],
    });

    return response.choices[0]?.message?.content || videoTitle;
  } catch (error) {
    if (isRateLimitError(error)) {
      throw new OpenAIRateLimitError(
        error instanceof Error ? error.message : "OpenAI rate limit exceeded"
      );
    }
    // Fallback to video title if caption generation fails
    console.error("Caption generation failed:", error);
    return videoTitle;
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
