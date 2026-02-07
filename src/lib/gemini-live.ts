/**
 * Gemini Live API — streaming text-to-speech.
 *
 * Takes plain text, opens a Live API WebSocket, and streams back audio
 * chunks in real-time. Used after chat() generates the structured text
 * response (with gesture/emote tags stripped).
 */
import {
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
} from "@google/genai";

let ai: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
  }
  return ai;
}

/**
 * Stream text as spoken audio via the Gemini Live API.
 *
 * @param text – Plain text to speak (no tags)
 * @param onAudioChunk – Called for each audio chunk as it arrives (base64 PCM 24kHz mono 16-bit)
 * @returns All collected audio chunks
 */
export async function streamSpeech(
  text: string,
  onAudioChunk?: (base64Audio: string) => void,
): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    const audioChunks: string[] = [];
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn("[gemini-live] Turn timed out after 30s");
        resolve(audioChunks);
      }
    }, 30_000);

    function onMessage(message: LiveServerMessage) {
      if (settled) return;

      const content = message.serverContent;
      if (!content) return;

      if (content.modelTurn?.parts) {
        for (const part of content.modelTurn.parts) {
          if (part.inlineData?.data) {
            audioChunks.push(part.inlineData.data);
            onAudioChunk?.(part.inlineData.data);
          }
        }
      }

      if (content.turnComplete) {
        settled = true;
        clearTimeout(timeout);
        resolve(audioChunks);
      }
    }

    getClient()
      .live.connect({
        model: "gemini-2.5-flash-native-audio-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Puck" },
            },
          },
          systemInstruction:
            "You are a voice synthesizer. Read the user's text aloud exactly as written. " +
            "Do not add commentary, disclaimers, or extra words. Just speak the text.",
        },
        callbacks: {
          onopen: () => {
            console.log("[gemini-live] Session opened");
          },
          onmessage: onMessage,
          onerror: (e: ErrorEvent) => {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              console.error("[gemini-live] Session error:", e.message);
              reject(new Error(`Live API error: ${e.message}`));
            }
          },
          onclose: () => {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              console.warn("[gemini-live] Session closed before turn complete");
              resolve(audioChunks);
            }
          },
        },
      })
      .then((session) => {
        session.sendClientContent({
          turns: [{ role: "user", parts: [{ text }] }],
        });
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(err);
        }
      });
  });
}
