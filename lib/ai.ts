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

/**
 * Map a language code (e.g. "en-IN", "hi-IN", "en") to a human-readable name for GPT context.
 */
function languageLabel(code?: string): string {
  if (!code) return "English";
  const map: Record<string, string> = {
    "en": "English", "en-IN": "English", "hi-IN": "Hindi", "bn-IN": "Bengali",
    "kn-IN": "Kannada", "ml-IN": "Malayalam", "mr-IN": "Marathi", "od-IN": "Odia",
    "pa-IN": "Punjabi", "ta-IN": "Tamil", "te-IN": "Telugu", "gu-IN": "Gujarati",
  };
  return map[code] || "English";
}

/**
 * Detect segments that are likely music/non-speech based on low word density.
 * Returns markers to insert into the transcript for GPT awareness.
 */
function detectLowSpeechRegions(segments: CaptionSegment[]): Map<number, string> {
  const markers = new Map<number, string>();
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const duration = seg.end - seg.start;
    if (duration <= 0) continue;
    const wordCount = seg.text.trim().split(/\s+/).length;
    const wordsPerSecond = wordCount / duration;
    // Very low speech density (< 0.5 words/sec over 3+ seconds) likely means music/non-speech
    if (duration >= 3 && wordsPerSecond < 0.5) {
      markers.set(i, `[LOW SPEECH / POSSIBLE MUSIC: ${duration.toFixed(1)}s with only ${wordCount} word(s)]`);
    }
  }
  return markers;
}

export async function findBestSegment(
  segments: CaptionSegment[],
  purpose: string | undefined,
  videoDuration: number,
  language?: string
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

  // Detect low-speech/music regions
  const musicMarkers = detectLowSpeechRegions(segments);
  const langName = languageLabel(language);

  // Build timestamped transcript for GPT with silence + music indicators
  let transcript = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // Insert music/low-speech marker before the segment if detected
    if (musicMarkers.has(i)) {
      transcript += `${musicMarkers.get(i)}\n`;
    }

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

  const languageNote = `\n\nLANGUAGE: This transcript is in ${langName}. You MUST understand and evaluate the ${langName} content for meaning, insight, and engagement. Do not treat non-English text as filler — read and understand it in its original language.`;

  const musicAvoidNote = `\nMUSIC/NON-SPEECH AVOIDANCE: Lines marked [LOW SPEECH / POSSIBLE MUSIC] indicate sections with very little actual speech (likely background music, intros, or instrumental breaks). NEVER select segments that fall within or overlap with these regions. Focus ONLY on sections with substantive spoken content.`;

  const systemPrompt = purpose
    ? `You are a video editor AI specializing in short-form viral content. Given a timestamped transcript and a user's purpose, find the single best continuous segment (15-60 seconds) that matches the purpose. The video is ${videoDuration} seconds long.${languageNote}

CRITICAL RULES:
1. The selected segment must NOT contain significant silence gaps. Avoid [SILENCE] markers. Only brief pauses (< 2s) are acceptable.
2. The clip should be engaging from start to finish with minimal dead air.
3. The segment must be self-contained — it should make sense without prior context.
4. Pick the most INSIGHTFUL part — the segment with the strongest ideas, opinions, or information value.${musicAvoidNote}

Prefer segments that start with a hook (question, bold statement, surprise), maintain energy throughout, and end with impact (punchline, key takeaway, or cliffhanger). Avoid segments that start mid-sentence or contain filler/introductory content.

Return JSON with exactly these fields:
- "start": number (seconds, must be >= 0)
- "end": number (seconds, must be <= ${videoDuration})
- "reason": string (1-2 sentence explanation of why this segment was chosen)

The segment duration (end - start) must be between 15 and 60 seconds. Pick the most compelling, insightful, self-contained segment with continuous speech.`
    : `You are a video editor AI specializing in short-form viral content. Find the single most compelling, viral-worthy continuous segment (15-60 seconds) from this transcript. The video is ${videoDuration} seconds long.${languageNote}

CRITICAL RULES:
1. The selected segment must NOT contain significant silence gaps. Avoid [SILENCE] markers. Only brief pauses (< 2s) are acceptable.
2. The clip should be engaging from start to finish with minimal dead air.${musicAvoidNote}

ENGAGEMENT HEURISTICS — prioritize segments that:
- **Contain the most insightful content**: Key ideas, unique perspectives, expert knowledge, or valuable information
- **Start with a hook**: Questions ("Did you know...?", "What if...?"), bold claims, surprising statements, or direct audience address
- **Have high speech density**: Rapid, energetic delivery with few pauses signals passion/expertise
- **Contain emotional peaks**: Laughter, excitement, strong opinions, or storytelling climaxes
- **Are self-contained**: The segment should make sense on its own without needing prior context
- **End with impact**: Punchlines, key takeaways, cliffhangers, or call-to-actions make the best clip endings
- **Feature topic shifts or reveals**: "But here's the thing..." or "The real reason is..." moments

AVOID segments that:
- Start mid-sentence or mid-thought
- Are purely introductory ("Hey guys, welcome back...")
- Contain only filler or meta-commentary about the video itself
- Fall within or overlap [LOW SPEECH / POSSIBLE MUSIC] regions
- Consist mostly of music, sound effects, or non-speech audio
- Trail off without a clear endpoint

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
          content: `${purpose ? `Purpose: ${purpose}\n\n` : ""}Language: ${langName}\n\nTranscript:\n${transcript}`,
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
  platform: "instagram" | "youtube",
  transcript?: string,
  language?: string
): Promise<string> {
  try {
    const platformName = platform === "instagram" ? "Instagram Reel" : "YouTube Shorts";
    const langName = languageLabel(language);
    const langNote = language && language !== "en" && language !== "en-IN"
      ? ` The clip content is in ${langName}. Write the caption in ${langName} (with English hashtags).`
      : "";

    const systemContent = transcript
      ? `You are a social media content creator. Generate a short, engaging ${platformName} caption/description based on the actual clip content (transcript provided).${langNote} Include 3-5 relevant hashtags at the end. Keep the caption under 150 characters (excluding hashtags). Be catchy and specific to what's said in the clip. Do not use emojis excessively.`
      : `You are a social media content creator. Generate a short, engaging ${platformName} caption/description for a video clip.${langNote} Include 3-5 relevant hashtags at the end. Keep it under 150 characters (excluding hashtags). Be catchy and use the video title as context. Do not use emojis excessively.`;

    const userContent = transcript
      ? `Video: "${videoTitle}" (${Math.round(clipDuration)}s clip)\nLanguage: ${langName}\n\nTranscript of this clip:\n${transcript.slice(0, 1000)}`
      : `Video: "${videoTitle}" (${Math.round(clipDuration)}s clip)\nLanguage: ${langName}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
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
