import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import OpenAI from "openai";
import { CaptionSegment, CaptionWord } from "./ffmpeg";

const execFileAsync = promisify(execFile);

const SARVAM_API_URL = "https://api.sarvam.ai/speech-to-text";
const MAX_CHUNK_SECS = 25; // Sarvam max is 30s, use 25 for safety

// Track consecutive Sarvam failures for circuit breaker
let sarvamFailureCount = 0;
const SARVAM_CIRCUIT_BREAKER_THRESHOLD = 3;
let sarvamCircuitOpenUntil = 0;
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

/**
 * Fallback: transcribe using OpenAI Whisper when Sarvam is unavailable.
 */
async function transcribeWithWhisper(
  audioPath: string,
  languageCode: string,
  audioDuration: number
): Promise<CaptionSegment[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("No fallback transcription available (OPENAI_API_KEY not set)");

  const openai = new OpenAI({ apiKey });
  const audioBuffer = fs.readFileSync(audioPath);
  const file = new File([audioBuffer], path.basename(audioPath), { type: "audio/mpeg" });

  // Map language code to ISO 639-1 for Whisper
  const langMap: Record<string, string> = {
    "en-IN": "en", "hi-IN": "hi", "bn-IN": "bn", "ta-IN": "ta",
    "te-IN": "te", "ml-IN": "ml", "kn-IN": "kn", "mr-IN": "mr",
    "gu-IN": "gu", "pa-IN": "pa", "ur-IN": "ur",
  };
  const whisperLang = langMap[languageCode] || languageCode.split("-")[0] || "en";

  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: whisperLang,
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  const words: CaptionWord[] = [];
  if (response.words && response.words.length > 0) {
    for (const w of response.words) {
      words.push({
        word: w.word,
        start: w.start,
        end: w.end,
      });
    }
    // Mark as medium confidence (Whisper fallback)
    const segments = groupWordsIntoSentences(words);
    for (const seg of segments) {
      seg.confidence = "medium";
    }
    return segments;
  }

  // No word-level timestamps, use text-based fallback
  if (response.text) {
    const segments = splitTranscriptIntoSegments(response.text, audioDuration);
    for (const seg of segments) {
      seg.confidence = "low";
    }
    return segments;
  }

  return [];
}

/**
 * Detect language from audio using OpenAI Whisper (auto-detection).
 * Returns ISO 639-1 language code.
 */
export async function detectLanguage(audioPath: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const openai = new OpenAI({ apiKey });
    const audioBuffer = fs.readFileSync(audioPath);
    const file = new File([audioBuffer], path.basename(audioPath), { type: "audio/mpeg" });

    const response = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
      response_format: "verbose_json",
    });

    return response.language || null;
  } catch (error) {
    console.error("Language detection failed:", error);
    return null;
  }
}

async function transcribeChunk(
  audioPath: string,
  languageCode: string,
  audioDuration: number
): Promise<CaptionSegment[]> {
  // Check circuit breaker
  const now = Date.now();
  const sarvamAvailable = sarvamFailureCount < SARVAM_CIRCUIT_BREAKER_THRESHOLD || now > sarvamCircuitOpenUntil;

  const apiKey = process.env.SERVAM_AI;
  if (!apiKey || !sarvamAvailable) {
    // No Sarvam key or circuit open — try Whisper fallback
    console.log(sarvamAvailable ? "No Sarvam API key, using Whisper fallback" : "Sarvam circuit breaker open, using Whisper fallback");
    return transcribeWithWhisper(audioPath, mapToSarvamLanguageCode(languageCode), audioDuration);
  }

  // Map to Sarvam's expected format (e.g., "en" -> "en-IN")
  const sarvamLanguageCode = mapToSarvamLanguageCode(languageCode);

  try {
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

    // Reset circuit breaker on success
    sarvamFailureCount = 0;

    const data: SarvamResponse = await res.json();

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
          // Distribute timing evenly across sub-words — mark as lower confidence
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
        const segments = groupWordsIntoSentences(words);
        // Assign confidence based on whether timing was estimated
        for (const seg of segments) {
          const hasEstimatedWords = seg.words?.some((w, idx) => {
            if (!seg.words || idx === 0) return false;
            const prev = seg.words[idx - 1];
            // Evenly distributed timing suggests estimation
            return Math.abs((w.end - w.start) - (prev.end - prev.start)) < 0.001;
          });
          seg.confidence = hasEstimatedWords ? "medium" : "high";
        }
        return segments;
      }
    }

    // Fallback: no word timestamps — estimate timing from transcript text
    if (data.transcript) {
      const segments = splitTranscriptIntoSegments(data.transcript, audioDuration);
      for (const seg of segments) {
        seg.confidence = "low";
      }
      return segments;
    }

    return [];
  } catch (error) {
    // Sarvam failed — increment circuit breaker and try Whisper
    sarvamFailureCount++;
    if (sarvamFailureCount >= SARVAM_CIRCUIT_BREAKER_THRESHOLD) {
      sarvamCircuitOpenUntil = Date.now() + 5 * 60 * 1000; // 5 min cooldown
      console.warn(`Sarvam circuit breaker opened after ${sarvamFailureCount} failures, cooldown 5 min`);
    }
    console.error("Sarvam failed, falling back to Whisper:", error);
    return transcribeWithWhisper(audioPath, sarvamLanguageCode, audioDuration);
  }
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
