import OpenAI from "openai";
import { CaptionSegment } from "./ffmpeg";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface SegmentResult {
  start: number;
  end: number;
  reason: string;
}

export async function findBestSegment(
  segments: CaptionSegment[],
  purpose: string | undefined,
  videoDuration: number
): Promise<SegmentResult> {
  // For short videos (≤40s), return the full range
  if (videoDuration <= 40) {
    return {
      start: 0,
      end: videoDuration,
      reason: "Video is short enough to use in full.",
    };
  }

  // Build timestamped transcript for GPT
  const transcript = segments
    .map(
      (s) =>
        `[${formatTime(s.start)} - ${formatTime(s.end)}] ${s.text}`
    )
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: purpose
          ? `You are a video editor AI. Given a timestamped transcript and a user's purpose, find the single best continuous segment (15-60 seconds) that matches the purpose. The video is ${videoDuration} seconds long.

Return JSON with exactly these fields:
- "start": number (seconds, must be >= 0)
- "end": number (seconds, must be <= ${videoDuration})
- "reason": string (1-2 sentence explanation of why this segment was chosen)

The segment duration (end - start) must be between 15 and 60 seconds. Pick the most compelling, self-contained segment.`
          : `You are a video editor AI. Find the single most compelling, viral-worthy continuous segment (15-60 seconds) from this transcript. The video is ${videoDuration} seconds long.

Pick the part with the strongest hook, highest entertainment value, or most useful information. Prefer segments that start with an attention-grabbing moment.

Return JSON with exactly these fields:
- "start": number (seconds, must be >= 0)
- "end": number (seconds, must be <= ${videoDuration})
- "reason": string (1-2 sentence explanation of why this segment was chosen)

The segment duration (end - start) must be between 15 and 60 seconds.`,
      },
      {
        role: "user",
        content: `${purpose ? `Purpose: ${purpose}\n\n` : ""}Transcript:\n${transcript}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("GPT returned empty response");
  }

  const result = JSON.parse(content) as SegmentResult;

  // Clamp to valid range
  result.start = Math.max(0, result.start);
  result.end = Math.min(videoDuration, result.end);

  // Ensure minimum duration
  if (result.end - result.start < 5) {
    result.end = Math.min(videoDuration, result.start + 15);
  }

  return result;
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
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
