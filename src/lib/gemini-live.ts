/**
 * Streaming text-to-speech via Gemini TTS REST API.
 *
 * Uses generateContent with AUDIO modality — the same proven approach
 * but wrapped to emit audio data through the streaming event bus.
 *
 * When the Live API becomes available with the project's API key,
 * this can be swapped for a WebSocket-based implementation.
 */
import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
  }
  return ai;
}

/**
 * Generate speech audio for the given text.
 *
 * @param text – Plain text to speak (no tags)
 * @param onAudioChunk – Called with the audio data (single chunk for REST API)
 * @returns The audio data as base64, or null on failure
 */
export async function streamSpeech(
  text: string,
  onAudioChunk?: (base64Audio: string) => void,
): Promise<string | null> {
  try {
    const response = await getClient().models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Say in a playful, energetic, slightly robotic digital voice: ${text}`,
            },
          ],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Puck" },
          },
        },
      },
    });

    const data =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (data) {
      onAudioChunk?.(data);
    }
    return data ?? null;
  } catch (err) {
    console.error("[tts] Gemini TTS error:", err);
    return null;
  }
}
