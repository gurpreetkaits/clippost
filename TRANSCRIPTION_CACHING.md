# Transcription Caching System

## Overview
ClipPost now permanently uses Sarvam AI for all transcriptions and implements intelligent transcription caching to avoid redundant transcriptions when creating multiple clips from the same video.

## Key Features

### 1. Permanent Sarvam AI Usage
All transcription now uses Sarvam AI, regardless of language:
- ✅ English: Sarvam AI (was OpenAI Whisper)
- ✅ Hindi: Sarvam AI
- ✅ Other languages: Sarvam AI

**Benefits:**
- Single, consistent transcription provider
- Lower cost than OpenAI Whisper
- No rate limit juggling between providers
- Supports 30+ Indian languages + English

### 2. Transcription Caching

When a video is transcribed for the first time:
1. Video is downloaded
2. Audio is extracted
3. Audio is transcribed with Sarvam AI
4. **Transcription is stored in database** (with language metadata)

When creating subsequent clips from the same video:
1. System checks if transcription exists
2. Checks if language matches
3. If both match → **reuses cached transcription**
4. Skips download, audio extraction, and transcription steps
5. Jumps directly to AI segment selection

## Database Schema

Added to `Video` model:
```prisma
model Video {
  // ... existing fields
  transcription Json?    // Stores CaptionSegment[] with timestamps
  language      String?  // Language used for transcription ("en", "hi", etc.)
}
```

The `transcription` field stores the complete array of caption segments with word-level timestamps:
```typescript
[
  {
    start: 0.0,
    end: 3.5,
    text: "This is the first segment",
    words: [
      { word: "This", start: 0.0, end: 0.4 },
      { word: "is", start: 0.4, end: 0.6 },
      // ...
    ]
  },
  // ...
]
```

## Implementation Details

### Cache Check Logic
```typescript
// Check for existing transcription
const existingTranscription = video.transcription;
const transcriptionLanguageMatch = video.language === requestedLanguage;

if (existingTranscription && transcriptionLanguageMatch) {
  // Use cached transcription
  segments = existingTranscription as unknown as CaptionSegment[];
} else {
  // Transcribe and cache
  segments = await transcribeFullAudioSarvam(audioPath, language);

  // Store in database
  await prisma.video.update({
    where: { id: video.id },
    data: {
      transcription: JSON.parse(JSON.stringify(segments)),
      language: language,
    },
  });
}
```

### Affected API Endpoints

#### `/api/autonomous` (Autonomous Mode)
- Checks cache before transcribing
- Stores transcription after first transcription
- Progress message: "Using cached transcription..." when cache hit

#### `/api/auto-trim` (Manual Mode with Auto-trim)
- Checks cache before transcribing
- Stores transcription after first transcription
- Progress message: "Using cached transcription..." when cache hit

#### `/api/transcribe` (Manual Clip Transcription)
- Always uses Sarvam AI
- Does NOT use cache (transcribes specific clip segments, not full video)

## Performance Benefits

### First Clip from Video
```
Download (5s) → Extract Audio (3s) → Transcribe (30s) → AI Select (2s) → Generate (5s)
Total: ~45 seconds
```

### Second+ Clip from Same Video
```
Load Cache (0.1s) → AI Select (2s) → Generate (5s)
Total: ~7 seconds
```

**Savings: ~38 seconds per clip (85% faster!)**

## Cache Invalidation

Cache is invalidated when:
- User requests a different language for the same video
- Video is re-uploaded (new `youtubeId`)

Cache persists:
- Across user sessions
- Indefinitely (no expiration)
- Even if video file is deleted (transcription remains)

## Migration

Migration created: `20260224221404_add_video_transcription`

Adds columns:
- `transcription`: JSONB (nullable)
- `language`: VARCHAR (nullable)

Existing videos will have `null` for these fields and will be transcribed on first use.

## API Cost Savings

### Before Caching
Creating 5 clips from one video:
- 5 × Sarvam transcription calls = 5 × cost

### After Caching
Creating 5 clips from one video:
- 1 × Sarvam transcription call = 1 × cost
- 4 clips reuse cached transcription = free

**Savings: 80% reduction in transcription API calls**

## Usage Examples

### Example 1: Creating Multiple Clips
```
User uploads: "podcast-episode.mp4"

First clip (motivational quote):
→ Transcribes entire video (30s)
→ Stores transcription in DB
→ Creates clip

Second clip (funny moment):
→ Loads transcription from DB (0.1s) ← FAST!
→ Creates clip

Third clip (key insight):
→ Loads transcription from DB (0.1s) ← FAST!
→ Creates clip
```

### Example 2: Different Languages
```
User uploads: "bilingual-video.mp4"

First clip (English):
→ Transcribes with language="en"
→ Stores transcription + language="en"

Second clip (Hindi):
→ Cache miss (language mismatch)
→ Transcribes with language="hi"
→ Updates transcription + language="hi"

Third clip (Hindi):
→ Cache hit (language matches)
→ Loads cached Hindi transcription
```

## Monitoring

To track cache effectiveness, monitor these queries:

```sql
-- Videos with cached transcriptions
SELECT COUNT(*) FROM videos WHERE transcription IS NOT NULL;

-- Total clips created
SELECT COUNT(*) FROM clips;

-- Cache hit ratio estimate
SELECT
  (SELECT COUNT(*) FROM clips) AS total_clips,
  (SELECT COUNT(*) FROM videos WHERE transcription IS NOT NULL) AS transcribed_videos,
  ROUND(
    (SELECT COUNT(*) FROM clips)::float /
    NULLIF((SELECT COUNT(*) FROM videos WHERE transcription IS NOT NULL), 0),
    2
  ) AS avg_clips_per_video;
```

## Configuration

No configuration needed - caching is automatic.

To disable caching (if needed):
1. Comment out cache check in routes
2. Always transcribe fresh

## Testing

Build verified: ✓ Successfully compiled with Next.js 16.1.6

To test caching:
1. Create first clip from a video → should transcribe
2. Create second clip from same video → should use cache
3. Check database: `transcription` field should be populated
4. Check progress messages: second clip should show "Using cached transcription..."

## Future Enhancements

1. **Cache Expiration**: Add `transcribedAt` timestamp and expire old transcriptions
2. **Cache Warming**: Pre-transcribe popular videos
3. **Partial Caching**: Cache segments instead of full transcription for very long videos
4. **Multi-language Support**: Store multiple transcriptions per video (one per language)
5. **Cache Analytics**: Track cache hit/miss rates, savings metrics
6. **Compression**: Compress stored transcriptions to save database space
7. **Background Jobs**: Transcribe videos in background after download

## Troubleshooting

### Cache not working
- Check if `video.transcription` is null
- Check if `video.language` matches requested language
- Ensure Prisma client is regenerated after migration

### Invalid cached data
- Cached transcription may have old format
- Clear cache: `UPDATE videos SET transcription = NULL, language = NULL;`
- Re-transcribe videos

### Database size concerns
- Monitor `videos` table size
- Consider adding cache expiration if storage becomes an issue
- Average transcription size: ~50KB per 10-minute video
