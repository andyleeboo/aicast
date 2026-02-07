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
  try {
    console.log(
      `[gemini-tts] Generating speech (${text.length} chars) via REST API`,
    );

    const response = await getClient().models.generateContent({
      model: "gemini-2.5-flash-native-audio-preview",
      contents: [{ role: "user", parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Puck" },
          },
        },
      },
    });

    // Extract audio data from the response
    const candidates = response.candidates;
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

    // REST TTS doesn't provide a transcript — return null
    return null;
  } catch (err) {
    console.error("[gemini-tts] streamSpeech error:", err);
    return null;
  }
}
