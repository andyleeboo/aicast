/**
 * Streaming text-to-speech via Gemini Live API (WebSocket).
 *
 * Opens a short-lived Live API session per request, sends text in,
 * and streams audio chunks back through the onAudioChunk callback.
 *
 * Audio format: 24 kHz mono 16-bit PCM (base64-encoded), matching
 * what the client audio player expects.
 */
import { GoogleGenAI, Modality, type Session } from "@google/genai";

let ai: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
  }
  return ai;
}

/**
 * Stream speech audio for the given text via the Gemini Live API.
 *
 * Opens a WebSocket session, sends the text, and calls `onAudioChunk`
 * for each incremental audio chunk. Resolves when the model's turn is
 * complete (all audio delivered).
 *
 * @param text – Plain text to speak (no tags)
 * @param onAudioChunk – Called with each base64 PCM audio chunk as it arrives
 */
export async function streamSpeech(
  text: string,
  onAudioChunk?: (base64Audio: string) => void,
): Promise<string | null> {
  let session: Session | undefined;

  try {
    return await new Promise<string | null>((resolve, reject) => {
      let transcript = "";
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.error("[gemini-live] Session timed out after 30s");
          session?.close();
          resolve(null);
        }
      }, 30_000);

      const connectAndSend = async () => {
        session = await getClient().live.connect({
          model: "gemini-2.5-flash-native-audio-preview",
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Puck" },
              },
            },
            outputAudioTranscription: {},
          },
          callbacks: {
            onmessage: (msg) => {
              // Audio chunks arrive in serverContent.modelTurn.parts
              const parts = msg.serverContent?.modelTurn?.parts;
              if (parts) {
                for (const part of parts) {
                  const audioData = part.inlineData?.data;
                  if (audioData) {
                    onAudioChunk?.(audioData);
                  }
                }
              }

              // Collect output transcript
              const transcriptionText =
                msg.serverContent?.outputTranscription?.text;
              if (transcriptionText) {
                transcript += transcriptionText;
              }

              // Turn complete — all audio has been delivered
              if (msg.serverContent?.turnComplete && !resolved) {
                resolved = true;
                clearTimeout(timeout);
                session?.close();
                resolve(transcript || null);
              }
            },
            onerror: (e) => {
              console.error("[gemini-live] Session error:", e);
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                reject(e);
              }
            },
            onclose: () => {
              console.log("[gemini-live] Session closed");
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                resolve(transcript || null);
              }
            },
          },
        });

        // Send the text to speak
        session.sendClientContent({
          turns: [{ role: "user", parts: [{ text }] }],
        });

        console.log(
          `[gemini-live] Sent text (${text.length} chars) to Live API`,
        );
      };

      connectAndSend().catch((err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  } catch (err) {
    console.error("[gemini-live] streamSpeech error:", err);
    session?.close();
    return null;
  }
}
