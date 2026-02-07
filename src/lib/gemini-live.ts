/**
 * Gemini Live API session manager.
 *
 * Opens a fresh WebSocket per turn for streaming text-to-audio.
 * Replaces the old two-step chat() + textToSpeech() pipeline.
 */
import {
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
} from "@google/genai";
import type { ChatMessage } from "./types";

let ai: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
  }
  return ai;
}

// ── Public API ───────────────────────────────────────────────────────

export interface SpeakResult {
  audioChunks: string[]; // base64 PCM chunks (24kHz mono 16-bit)
  transcript: string;
}

/**
 * Send conversation messages through the Live API and collect streamed audio.
 *
 * Opens a fresh WebSocket, sends the conversation, streams audio chunks
 * back via `onAudioChunk`, and resolves with all chunks + transcript
 * when the turn completes.
 *
 * @param systemPrompt – Full system prompt (personality + action instructions)
 * @param messages – Conversation history to send as context
 * @param onAudioChunk – Called for each audio chunk as it arrives
 * @returns Collected audio chunks and the text transcript
 */
export async function speakWithVoice(
  systemPrompt: string,
  messages: ChatMessage[],
  onAudioChunk?: (base64Audio: string) => void,
): Promise<SpeakResult> {
  return new Promise<SpeakResult>((resolve, reject) => {
    const audioChunks: string[] = [];
    let transcript = "";
    let settled = false;

    // Safety timeout — don't hang forever
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn("[gemini-live] Turn timed out after 30s");
        resolve({ audioChunks, transcript });
      }
    }, 30_000);

    function onMessage(message: LiveServerMessage) {
      if (settled) return;

      const content = message.serverContent;
      if (!content) return;

      // Audio chunks arrive in modelTurn.parts[].inlineData
      if (content.modelTurn?.parts) {
        for (const part of content.modelTurn.parts) {
          if (part.inlineData?.data) {
            audioChunks.push(part.inlineData.data);
            onAudioChunk?.(part.inlineData.data);
          }
        }
      }

      // Output transcription arrives independently
      if (content.outputTranscription?.text) {
        transcript += content.outputTranscription.text;
      }

      // Turn complete — we have all audio + transcript
      if (content.turnComplete) {
        settled = true;
        clearTimeout(timeout);
        resolve({ audioChunks, transcript });
      }
    }

    getClient()
      .live.connect({
        model: "gemini-2.5-flash-native-audio-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Puck" },
            },
          },
          systemInstruction: systemPrompt,
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
              resolve({ audioChunks, transcript });
            }
          },
        },
      })
      .then((session) => {
        // Build the turns from message history
        const turns = messages.map((m) => ({
          role: m.role === "assistant" ? ("model" as const) : ("user" as const),
          parts: [{ text: m.content }],
        }));

        // Send all messages as context
        if (turns.length > 0) {
          session.sendClientContent({ turns });
        } else {
          // If no messages, send a minimal turn to trigger a response
          session.sendClientContent({
            turns: [{ role: "user", parts: [{ text: "(silence)" }] }],
          });
        }
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
