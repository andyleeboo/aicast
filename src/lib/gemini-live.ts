/**
 * Text-to-speech via Gemini REST API (generateContent).
 *
 * Uses a single HTTP request instead of a WebSocket session, making it
 * compatible with serverless environments like Vercel where long-lived
 * connections are killed.
 *
 * Audio format: 24 kHz mono 16-bit PCM (base64-encoded), matching
 * what the client audio player expects.
 */
import { GoogleGenAI, Modality } from "@google/genai";

let ai: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
  }
  return ai;
}

/** Max time to wait for TTS response before giving up. */
const TTS_TIMEOUT_MS = 15_000;

/** Cap input text to avoid huge TTS requests that timeout or cost too much. */
const MAX_TTS_CHARS = 1000;

/**
 * Generate speech audio for the given text via the Gemini REST API.
 *
 * Calls generateContent with AUDIO modality and delivers audio chunks
 * through the onAudioChunk callback. Resolves when all audio is delivered.
 *
 * @param text – Plain text to speak (no tags)
 * @param onAudioChunk – Called with each base64 PCM audio chunk
 */
export async function streamSpeech(
  text: string,
  onAudioChunk?: (base64Audio: string) => void,
): Promise<string | null> {
  // Cap input length to prevent overly long TTS requests
  const input =
    text.length > MAX_TTS_CHARS
      ? text.slice(0, MAX_TTS_CHARS) + "..."
      : text;

  try {
    console.log(
      `[gemini-tts] Generating speech (${input.length} chars) via REST API`,
    );

    // Race the TTS call against a timeout
    const result = await Promise.race([
      getClient().models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ role: "user", parts: [{ text: input }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Puck" },
            },
          },
        },
      }),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("TTS timed out after 15s")), TTS_TIMEOUT_MS),
      ),
    ]);

    if (!result) return null;

    // Extract audio data from the response
    const candidates = result.candidates;
    if (!candidates?.length) {
      console.warn("[gemini-tts] No candidates in response");
      return null;
    }

    let hasAudio = false;
    for (const candidate of candidates) {
      const parts = candidate.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        const audioData = part.inlineData?.data;
        if (audioData) {
          hasAudio = true;
          onAudioChunk?.(audioData);
        }
      }
    }

    if (!hasAudio) {
      console.warn("[gemini-tts] Response contained no audio data");
    }

    return null;
  } catch (err) {
    console.error("[gemini-tts] streamSpeech error:", err);
    return null;
  }
}
