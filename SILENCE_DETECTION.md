# Silence Detection Implementation

## Overview
Enhanced the autonomous clip generation to avoid selecting segments with significant silence gaps, ensuring generated clips are continuously engaging without dead air.

## Changes Made to `lib/ai.ts`

### 1. Silence Gap Detection
Added `detectSilenceGaps()` function that analyzes transcription segments to identify silence gaps > 2 seconds between spoken words.

### 2. Silence Calculation
Added `calculateSilenceInRange()` to compute the total silence duration within any selected time range.

### 3. Boundary Trimming
Added `trimSilenceFromBoundaries()` to automatically remove silence from the start and end of selected clips, ensuring clips begin and end with actual speech.

### 4. Continuous Speech Block Detection
Added `findContinuousSpeechBlocks()` to identify blocks of continuous speech (with gaps ≤ 2s) within a time range. This is used as a fallback when the AI-selected segment has too much silence.

### 5. Enhanced AI Prompt
Modified the GPT prompt to:
- Include `[SILENCE: X.Xs]` markers in the transcript where gaps > 2s exist
- Explicitly instruct the AI to avoid segments with significant silence
- Prioritize continuous speech segments

### 6. Post-Processing Validation
After the AI selects a segment, the code now:
1. Trims silence from boundaries
2. Calculates the silence ratio (silence duration / total duration)
3. If silence ratio > 30%, automatically finds and uses the longest continuous speech block instead
4. Ensures minimum duration requirements are still met

## How It Works

### Workflow
1. **Transcription**: Audio is transcribed with word-level timestamps (Whisper or Sarvam)
2. **Silence Detection**: Gaps between segments are identified
3. **AI Selection**: GPT-4o-mini receives transcript with silence markers and selects the best segment while avoiding silence
4. **Validation**: Selected segment is validated for silence content
5. **Adjustment**: If needed, segment boundaries are adjusted to minimize silence
6. **Output**: Final clip has continuous, engaging content without dead air

### Example
```
Original transcript:
[0:00 - 0:05] This is an interesting thought
[SILENCE: 5.0s]
[0:10 - 0:15] about how we can improve
[0:15 - 0:25] our approach to content creation
[SILENCE: 3.5s]
[0:28 - 0:35] which is really important

Result: AI will prefer the 0:10-0:25 segment (continuous speech)
or adjust boundaries to avoid the 3.5s gap.
```

## Benefits
- ✅ No more clips with awkward silence in the middle
- ✅ Clips start immediately with speech (no silent intro)
- ✅ Clips end at the end of speech (no trailing silence)
- ✅ Automatic fallback to longest speech block if AI picks poorly
- ✅ Works with both English (Whisper) and non-English (Sarvam) transcription
- ✅ Configurable threshold (currently 2 seconds for gap detection, 30% for silence ratio)

## Configuration
You can adjust these parameters in `lib/ai.ts`:
- `threshold` in `detectSilenceGaps()`: Default 2 seconds
- `silenceRatio` check: Default 0.3 (30%)
- Minimum continuous block duration: Default 10 seconds

## Testing
Build verified: ✓ Compiled successfully with Next.js 16.1.6

## Future Enhancements
- Add user preference for silence tolerance
- Expose silence detection metrics in the API response
- Add audio-level silence detection (not just transcript gaps) for more accuracy
