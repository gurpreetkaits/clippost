# OpenAI Fallback System

## Overview
Automatic fallback mechanisms to ensure ClipPost continues working even when OpenAI API rate limits are reached. The system gracefully switches to alternative services (Sarvam AI) or heuristic approaches without interrupting the user experience.

## Fallback Mechanisms

### 1. Transcription Fallback
**Primary**: OpenAI Whisper (for English)
**Fallback**: Sarvam AI (automatically used when Whisper rate limit hit)

**How it works:**
- User sets language to English → attempts Whisper transcription
- If rate limit error detected (429, "rate limit", "quota exceeded")
- Automatically switches to Sarvam AI with English language code
- Progress message updated: "OpenAI limit reached, switching to Sarvam AI..."
- Continues seamlessly without user intervention

**Code location:** `app/api/autonomous/route.ts:136-160`

**Error detection:**
```typescript
catch (error) {
  if (error instanceof WhisperRateLimitError) {
    // Fallback to Sarvam AI
    segments = await transcribeFullAudioSarvam(audioPath, "en", transcribeProgress);
  }
}
```

### 2. AI Segment Selection Fallback
**Primary**: GPT-4o-mini (intelligent segment selection)
**Fallback**: Heuristic algorithm (longest continuous speech block)

**How it works:**
- AI attempts to find best segment using GPT-4o-mini
- If rate limit error detected
- Uses heuristic algorithm:
  1. Identifies continuous speech blocks (gaps ≤ 2s between segments)
  2. Filters blocks between 15-60 seconds
  3. Selects the longest qualifying block
  4. If no qualifying block found, uses first 30 seconds
- Progress message: "OpenAI limit reached, using heuristic selection..."

**Code location:** `app/api/autonomous/route.ts:162-212`

**Heuristic logic:**
```typescript
// Find longest continuous speech block (15-60s)
const speechBlocks = [];
let currentBlock = { start: segments[0].start, end: segments[0].end };

for (let i = 1; i < segments.length; i++) {
  const gap = segments[i].start - currentBlock.end;
  if (gap <= 2) {
    currentBlock.end = segments[i].end; // Extend block
  } else {
    // Gap too large, save block and start new one
    if (duration >= 15 && duration <= 60) {
      speechBlocks.push(currentBlock);
    }
    currentBlock = { start: segments[i].start, end: segments[i].end };
  }
}

// Pick longest block
const longest = speechBlocks.reduce((a, b) => a.duration > b.duration ? a : b);
```

### 3. Caption Generation Fallback
**Primary**: GPT-4o-mini (AI-generated captions)
**Fallback**: Video title

**How it works:**
- Attempts to generate engaging caption with GPT-4o-mini
- If rate limit or any error occurs
- Falls back to using the video title as caption
- Error logged to console but doesn't break the flow

**Code location:** `lib/ai.ts:320-342`

## Rate Limit Detection

Rate limit errors are detected by checking for:
- HTTP status code 429
- Error messages containing "rate limit"
- Error messages containing "quota"
- Error messages containing "too many requests"

**Implementation:**
```typescript
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
```

## Custom Error Classes

### OpenAIRateLimitError (Whisper)
Defined in `lib/whisper.ts`
```typescript
export class OpenAIRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAIRateLimitError";
  }
}
```

### OpenAIRateLimitError (AI)
Defined in `lib/ai.ts`
```typescript
export class OpenAIRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAIRateLimitError";
  }
}
```

## User Experience

Users see transparent progress updates when fallbacks are triggered:

1. **Transcription Fallback**:
   - "Transcribing audio..." → "OpenAI limit reached, switching to Sarvam AI..." → "Transcription complete (Sarvam AI)"

2. **Segment Selection Fallback**:
   - "Finding best segment..." → "OpenAI limit reached, using heuristic selection..." → "Found: Selected using heuristic fallback (longest continuous speech)"

3. **Caption Generation Fallback**:
   - Silent fallback, uses video title (no progress message needed as this is non-critical)

## Benefits

✅ **Zero Downtime**: Service continues even when OpenAI limits hit
✅ **Transparent**: Users are informed when fallbacks occur
✅ **Graceful Degradation**: Quality degrades slightly but functionality maintained
✅ **Cost Optimization**: Automatically uses cheaper Sarvam AI when OpenAI unavailable
✅ **No Manual Intervention**: Fully automatic switching

## Configuration

All fallback behavior is automatic and requires no configuration. However, you can adjust:

### Sarvam AI API Key
Ensure `SERVAM_AI` environment variable is set for fallback transcription to work.

### Heuristic Parameters
Edit `app/api/autonomous/route.ts:179-194` to adjust:
- Gap threshold: Currently 2 seconds (line 181: `if (gap <= 2)`)
- Duration range: Currently 15-60 seconds (line 187: `if (duration >= 15 && duration <= 60)`)
- Default fallback: Currently first 30 seconds (line 207: `Math.min(30, metadata.duration)`)

## Testing

Build verified: ✓ Successfully compiled with Next.js 16.1.6

To test fallback behavior:
1. Set invalid/expired OpenAI API key
2. Trigger autonomous clip generation
3. Verify fallback to Sarvam AI occurs
4. Check progress messages show fallback status

## Monitoring

Add logging to track fallback usage:
```typescript
console.log("OpenAI rate limit reached, falling back to Sarvam AI");
console.log("OpenAI rate limit for AI selection, using heuristic fallback");
```

Consider adding metrics:
- Count of Whisper → Sarvam fallbacks
- Count of AI → Heuristic fallbacks
- Track fallback frequency to optimize API usage

## Future Enhancements

1. **Retry Logic**: Implement exponential backoff before falling back
2. **Smart Rate Limit Tracking**: Predict and prevent rate limits proactively
3. **Multiple AI Providers**: Add Claude/Gemini as additional AI fallback options
4. **User Notification**: Show banner when fallbacks are active
5. **Fallback Preferences**: Let users configure fallback behavior
6. **Analytics Dashboard**: Show fallback usage statistics
