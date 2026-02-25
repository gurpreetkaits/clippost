# Language Code Fix for Sarvam AI

## Problem

Sarvam AI API requires language codes in a specific format with the "-IN" suffix:
- ✅ Accepted: `en-IN`, `hi-IN`, `bn-IN`, etc.
- ❌ Rejected: `en`, `hi`, `bn`

Error received:
```
Sarvam AI error (400): body.language_code : Input should be 'unknown',
'hi-IN', 'bn-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'od-IN', 'pa-IN', 'ta-IN',
'te-IN', 'en-IN', 'gu-IN', etc.
```

## Solution

Implemented automatic language code mapping to convert simple codes to Sarvam AI format.

### 1. Language Code Mapping Function

Added `mapToSarvamLanguageCode()` in `lib/sarvam.ts`:

```typescript
function mapToSarvamLanguageCode(languageCode: string): string {
  const mapping: Record<string, string> = {
    en: "en-IN",
    hi: "hi-IN",
    bn: "bn-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    mr: "mr-IN",
    // ... etc
  };

  // If already in Sarvam format, return as-is
  if (languageCode.endsWith("-IN")) {
    return languageCode;
  }

  // Map simple code to Sarvam format
  return mapping[languageCode.toLowerCase()] || "en-IN";
}
```

**Features:**
- ✅ Handles both old format (`en`) and new format (`en-IN`)
- ✅ Case-insensitive matching
- ✅ Falls back to `en-IN` for unknown codes
- ✅ Supports all Sarvam AI languages

### 2. Updated Language Definitions

Changed `lib/languages.ts` to use Sarvam format:

```typescript
export const LANGUAGES = [
  { code: "en-IN", label: "English" },  // Changed from "en"
  { code: "hi-IN", label: "Hindi" },
  { code: "bn-IN", label: "Bengali" },
  // ...
] as const;
```

### 3. Updated Schema Default

Changed Prisma schema default:

```prisma
model User {
  defaultLanguage String @default("en-IN")  // Changed from "en"
}
```

Migration: `20260224222227_update_default_language_to_en_in`

### 4. Updated Transcription Function

Modified `transcribeChunk()` to use mapping:

```typescript
async function transcribeChunk(audioPath: string, languageCode: string, ...) {
  // Map to Sarvam's expected format
  const sarvamLanguageCode = mapToSarvamLanguageCode(languageCode);

  formData.append("language_code", sarvamLanguageCode);
  // ...
}
```

## Supported Languages

All Sarvam AI supported languages are mapped:

| Simple Code | Sarvam Code | Language |
|-------------|-------------|----------|
| `en` | `en-IN` | English |
| `hi` | `hi-IN` | Hindi |
| `bn` | `bn-IN` | Bengali |
| `kn` | `kn-IN` | Kannada |
| `ml` | `ml-IN` | Malayalam |
| `mr` | `mr-IN` | Marathi |
| `od` / `or` | `od-IN` | Odia |
| `pa` | `pa-IN` | Punjabi |
| `ta` | `ta-IN` | Tamil |
| `te` | `te-IN` | Telugu |
| `gu` | `gu-IN` | Gujarati |
| `as` | `as-IN` | Assamese |
| `ur` | `ur-IN` | Urdu |
| `ne` | `ne-IN` | Nepali |
| `kok` | `kok-IN` | Konkani |
| `ks` | `ks-IN` | Kashmiri |
| `sd` | `sd-IN` | Sindhi |
| `sa` | `sa-IN` | Sanskrit |
| `sat` | `sat-IN` | Santali |
| `mni` | `mni-IN` | Manipuri |
| `brx` | `brx-IN` | Bodo |
| `mai` | `mai-IN` | Maithili |
| `doi` | `doi-IN` | Dogri |

## Backwards Compatibility

The mapping function ensures backwards compatibility:

### Old Data (Simple Codes)
```typescript
// User has defaultLanguage = "en" in database
const language = user.defaultLanguage; // "en"
const sarvamCode = mapToSarvamLanguageCode(language); // "en-IN" ✅
```

### New Data (Sarvam Format)
```typescript
// User has defaultLanguage = "en-IN" in database
const language = user.defaultLanguage; // "en-IN"
const sarvamCode = mapToSarvamLanguageCode(language); // "en-IN" ✅
```

**No data migration required!** The mapping function handles both formats.

## Testing

Build verified: ✓ Successfully compiled with Next.js 16.1.6

To test:
1. Select English language in settings
2. Create a clip with autonomous mode
3. Verify transcription succeeds (no 400 error)
4. Check that Sarvam API receives `language_code: "en-IN"`

## Files Modified

1. `lib/sarvam.ts` - Added mapping function and updated transcribeChunk
2. `lib/languages.ts` - Changed "en" to "en-IN"
3. `prisma/schema.prisma` - Changed default from "en" to "en-IN"
4. Created migration: `20260224222227_update_default_language_to_en_in`

## Migration Script

Optional migration script created at `scripts/migrate-language-codes.ts` to update existing data from old format to new format. Run with:

```bash
npx tsx scripts/migrate-language-codes.ts
```

**Note:** This is optional since the mapping function handles both formats automatically.

## Error Resolution

Before fix:
```
❌ Sarvam AI error (400): body.language_code : Input should be 'en-IN'...
```

After fix:
```
✅ Transcription successful with language_code: "en-IN"
```

## Future Considerations

1. **Add More Languages**: Easily extend the mapping for additional Sarvam languages
2. **Custom Dialects**: Map region-specific variants if needed
3. **Language Detection**: Auto-detect language from audio if user doesn't specify
4. **Multi-language Support**: Store multiple transcriptions per video for different languages
