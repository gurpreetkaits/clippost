import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { CaptionSegment, CaptionWord } from "./ffmpeg";

const execFileAsync = promisify(execFile);

const SARVAM_API_URL = "https://api.sarvam.ai/speech-to-text";
const MAX_CHUNK_SECS = 25; // Sarvam max is 30s, use 25 for safety
/**
 * Maps simple language codes (en, hi, etc.) to Sarvam AI format (en-IN, hi-IN, etc.)
 */
function mapToSarvamLanguageCode(languageCode: string): string {
  const mapping: Record<string, string> = {
    en: "en-IN",
    hi: "hi-IN",
    bn: "bn-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    mr: "mr-IN",
    od: "od-IN",
    or: "od-IN", // Odia alternative code
    pa: "pa-IN",
    ta: "ta-IN",
    te: "te-IN",
    gu: "gu-IN",
    as: "as-IN",
    ur: "ur-IN",
    ne: "ne-IN",
    kok: "kok-IN",
    ks: "ks-IN",
    sd: "sd-IN",
    sa: "sa-IN",
    sat: "sat-IN",
    mni: "mni-IN",
    brx: "brx-IN",
    mai: "mai-IN",
    doi: "doi-IN",
  };

  // If already in Sarvam format, return as-is
  if (languageCode.endsWith("-IN")) {
    return languageCode;
  }

  // Map simple code to Sarvam format
  return mapping[languageCode.toLowerCase()] || "en-IN"; // Default to en-IN
}

interface SarvamResponse {
  transcript: string;
  timestamps?: {
    words: string[];
    start_time_seconds: number[];
    end_time_seconds: number[];
  };
  language_code: string;
}

/**
 * Group words into sentence-level segments based on punctuation and natural pauses.
 * Sentences end at: period/question/exclamation marks, or pauses > 0.7s between words.
 */
function groupWordsIntoSentences(words: CaptionWord[]): CaptionSegment[] {
  if (words.length === 0) return [];

  const segments: CaptionSegment[] = [];
  let chunk: CaptionWord[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    chunk.push(word);

    const isSentenceEnd = /[.?!]$/.test(word.word);
    const hasLongPause =
      i < words.length - 1 && words[i + 1].start - word.end > 0.7;
    const isLastWord = i === words.length - 1;

    if (isSentenceEnd || hasLongPause || isLastWord) {
      segments.push({
        start: chunk[0].start,
        end: chunk[chunk.length - 1].end,
        text: chunk.map((w) => w.word).join(" "),
        words: [...chunk],
      });
      chunk = [];
    }
  }

  return segments;
}

/**
 * Split a transcript string into timed segments with word-level karaoke timing.
 * Used as fallback when Sarvam doesn't return word timestamps.
 */
function splitTranscriptIntoSegments(
  transcript: string,
  audioDuration: number
): CaptionSegment[] {
  const allWords = transcript.split(/\s+/).filter((w) => w.length > 0);
  if (allWords.length === 0) return [];

  // Estimate timing: distribute words evenly across the audio duration
  const wordDuration = audioDuration / allWords.length;

  const words: CaptionWord[] = allWords.map((word, i) => ({
    word,
    start: parseFloat((i * wordDuration).toFixed(2)),
    end: parseFloat(((i + 1) * wordDuration).toFixed(2)),
  }));

  return groupWordsIntoSentences(words);
}

async function getAudioDuration(audioPath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    audioPath,
  ]);
  return parseFloat(stdout.trim());
}

async function transcribeChunk(
  audioPath: string,
  languageCode: string,
  audioDuration: number
): Promise<CaptionSegment[]> {
  const apiKey = process.env.SERVAM_AI;
  if (!apiKey) throw new Error("SERVAM_AI API key not configured");

  // Map to Sarvam's expected format (e.g., "en" -> "en-IN")
  const sarvamLanguageCode = mapToSarvamLanguageCode(languageCode);

  const audioBuffer = fs.readFileSync(audioPath);
  const file = new File([audioBuffer], path.basename(audioPath), { type: "audio/mpeg" });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "saaras:v3");
  formData.append("mode", "transcribe");
  formData.append("language_code", sarvamLanguageCode);
  formData.append("with_timestamps", "true");

  const res = await fetch(SARVAM_API_URL, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Sarvam AI error:", res.status, errText);
    throw new Error(`Sarvam AI error (${res.status}): ${errText}`);
  }

  const data: SarvamResponse = await res.json();

  console.log("Sarvam response:", JSON.stringify({
    hasTimestamps: !!data.timestamps,
    wordCount: data.timestamps?.words?.length ?? 0,
    sampleWords: data.timestamps?.words?.slice(0, 5),
    sampleStarts: data.timestamps?.start_time_seconds?.slice(0, 5),
    sampleEnds: data.timestamps?.end_time_seconds?.slice(0, 5),
    transcriptLength: data.transcript?.length ?? 0,
  }));

  if (data.timestamps && data.timestamps.words.length > 0) {
    // Sarvam may return multi-word entries — flatten them into individual words
    const rawWords = data.timestamps.words;
    const rawStarts = data.timestamps.start_time_seconds;
    const rawEnds = data.timestamps.end_time_seconds;

    const words: CaptionWord[] = [];

    for (let i = 0; i < rawWords.length; i++) {
      const entry = rawWords[i].trim();
      const entryStart = rawStarts[i];
      const entryEnd = rawEnds[i];

      // If the entry contains spaces, it's a multi-word chunk — split it
      const subWords = entry.split(/\s+/).filter((w) => w.length > 0);
      if (subWords.length <= 1) {
        words.push({ word: entry, start: entryStart, end: entryEnd });
      } else {
        // Distribute timing evenly across sub-words
        const subDuration = (entryEnd - entryStart) / subWords.length;
        for (let j = 0; j < subWords.length; j++) {
          words.push({
            word: subWords[j],
            start: parseFloat((entryStart + j * subDuration).toFixed(2)),
            end: parseFloat((entryStart + (j + 1) * subDuration).toFixed(2)),
          });
        }
      }
    }

    if (words.length > 0) {
      return groupWordsIntoSentences(words);
    }
  }

  // Fallback: no word timestamps — estimate timing from transcript text
  if (data.transcript) {
    return splitTranscriptIntoSegments(data.transcript, audioDuration);
  }

  return [];
}

async function splitAndTranscribe(
  audioPath: string,
  languageCode: string,
  onProgress?: (percent: number) => void
): Promise<CaptionSegment[]> {
  const totalDuration = await getAudioDuration(audioPath);

  if (totalDuration <= MAX_CHUNK_SECS) {
    onProgress?.(50);
    const segments = await transcribeChunk(audioPath, languageCode, totalDuration);
    onProgress?.(100);
    return segments;
  }

  const dir = path.dirname(audioPath);
  const base = path.basename(audioPath, path.extname(audioPath));
  const numChunks = Math.ceil(totalDuration / MAX_CHUNK_SECS);
  const allSegments: CaptionSegment[] = [];
  const chunkPaths: string[] = [];

  try {
    for (let i = 0; i < numChunks; i++) {
      const chunkStart = i * MAX_CHUNK_SECS;
      const chunkPath = path.join(dir, `${base}_sarvam_chunk${i}.mp3`);
      chunkPaths.push(chunkPath);

      await execFileAsync("ffmpeg", [
        "-y", "-ss", chunkStart.toString(),
        "-i", audioPath,
        "-t", MAX_CHUNK_SECS.toString(),
        "-acodec", "libmp3lame", "-ar", "16000", "-ac", "1", "-b:a", "32k",
        chunkPath,
      ], { timeout: 60000 });

      const chunkDuration = Math.min(MAX_CHUNK_SECS, totalDuration - chunkStart);
      const chunkSegments = await transcribeChunk(chunkPath, languageCode, chunkDuration);

      for (const seg of chunkSegments) {
        seg.start += chunkStart;
        seg.end += chunkStart;
        if (seg.words) {
          for (const w of seg.words) {
            w.start += chunkStart;
            w.end += chunkStart;
          }
        }
      }

      allSegments.push(...chunkSegments);
      onProgress?.(Math.round(((i + 1) / numChunks) * 100));
    }
  } finally {
    for (const cp of chunkPaths) {
      if (fs.existsSync(cp)) fs.unlinkSync(cp);
    }
  }

  return allSegments;
}

export async function transcribeAudioSarvam(
  audioPath: string,
  languageCode: string
): Promise<CaptionSegment[]> {
  return splitAndTranscribe(audioPath, languageCode);
}

export async function transcribeFullAudioSarvam(
  audioPath: string,
  languageCode: string,
  onProgress?: (percent: number) => void
): Promise<CaptionSegment[]> {
  return splitAndTranscribe(audioPath, languageCode, onProgress);
}
