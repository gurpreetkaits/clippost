import OpenAI from "openai";
import fs from "fs";
import { CaptionSegment } from "./ffmpeg";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function transcribeAudio(
  audioPath: string
): Promise<CaptionSegment[]> {
  const audioFile = fs.createReadStream(audioPath);

  const response = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  const segments: CaptionSegment[] = (
    response as unknown as {
      segments: Array<{ start: number; end: number; text: string }>;
    }
  ).segments.map((seg) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
  }));

  return segments;
}
