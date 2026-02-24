import OpenAI from "openai";
import fs from "fs";
import { CaptionSegment, CaptionWord } from "./ffmpeg";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_DURATION = 3;
const MAX_WORDS = 5;

function groupWordsIntoSegments(
  words: CaptionWord[]
): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  let chunk: CaptionWord[] = [];

  for (const word of words) {
    const chunkStart = chunk.length > 0 ? chunk[0].start : word.start;
    const wouldExceedDuration = word.end - chunkStart > MAX_DURATION;
    const wouldExceedWords = chunk.length >= MAX_WORDS;

    if (chunk.length > 0 && (wouldExceedDuration || wouldExceedWords)) {
      segments.push({
        start: chunk[0].start,
        end: chunk[chunk.length - 1].end,
        text: chunk.map((w) => w.word).join(" "),
        words: [...chunk],
      });
      chunk = [];
    }

    chunk.push(word);
  }

  if (chunk.length > 0) {
    segments.push({
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
      text: chunk.map((w) => w.word).join(" "),
      words: [...chunk],
    });
  }

  return segments;
}

// Split a long segment into shorter chunks (safety net)
function splitLongSegment(seg: CaptionSegment): CaptionSegment[] {
  // If segment has word-level data, split using words
  if (seg.words && seg.words.length > 0) {
    if (seg.words.length <= MAX_WORDS && seg.end - seg.start <= MAX_DURATION) {
      return [seg];
    }
    return groupWordsIntoSegments(seg.words);
  }

  // Text-only fallback: split by word count with proportional timing
  const words = seg.text.split(/\s+/);
  if (words.length <= MAX_WORDS && seg.end - seg.start <= MAX_DURATION) {
    return [seg];
  }

  const numChunks = Math.ceil(words.length / MAX_WORDS);
  const wordsPerChunk = Math.ceil(words.length / numChunks);
  const totalDuration = seg.end - seg.start;
  const results: CaptionSegment[] = [];

  for (let i = 0; i < numChunks; i++) {
    const chunkWords = words.slice(i * wordsPerChunk, (i + 1) * wordsPerChunk);
    if (chunkWords.length === 0) continue;
    const chunkStart = seg.start + (i / numChunks) * totalDuration;
    const chunkEnd = seg.start + ((i + 1) / numChunks) * totalDuration;
    results.push({
      start: parseFloat(chunkStart.toFixed(2)),
      end: parseFloat(chunkEnd.toFixed(2)),
      text: chunkWords.join(" "),
    });
  }

  return results;
}

export function splitLongSegments(
  segments: CaptionSegment[]
): CaptionSegment[] {
  return segments.flatMap(splitLongSegment);
}

export async function transcribeAudio(
  audioPath: string
): Promise<CaptionSegment[]> {
  const audioFile = fs.createReadStream(audioPath);

  const response = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  const data = response as unknown as {
    words?: Array<{ word: string; start: number; end: number }>;
    segments?: Array<{ start: number; end: number; text: string }>;
  };

  // Prefer word-level timestamps
  if (data.words && data.words.length > 0) {
    const words: CaptionWord[] = data.words.map((w) => ({
      word: w.word.trim(),
      start: w.start,
      end: w.end,
    }));
    return groupWordsIntoSegments(words);
  }

  // Fallback: split long segments from segment-level data
  if (data.segments && data.segments.length > 0) {
    const segments = data.segments.map((seg) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
    }));
    return splitLongSegments(segments);
  }

  return [];
}
