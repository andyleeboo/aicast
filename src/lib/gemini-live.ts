/**
 * TTS provider abstraction — swap models/APIs by changing the provider list.
 *
 * Current providers (tried in order):
 *  1. Gemini 2.5 Pro TTS  (highest quality, separate quota from Flash)
 *  2. Gemini 2.5 Flash TTS (lower latency, may share quota)
 *
 * Audio format: 24 kHz mono 16-bit PCM (base64-encoded), matching
 * what the client audio player expects.
 *
 * If ALL server providers fail, the client falls back to the browser
 * Web Speech API (see broadcast-content.tsx).
 */
import { GoogleGenAI, Modality } from "@google/genai";

// ── Types ────────────────────────────────────────────────────────────

export interface TtsProvider {
  name: string;
  generateSpeech(
    text: string,
    onChunk: (base64Audio: string) => void,
  ): Promise<boolean>; // true = audio delivered, false = failed
}

// ── Gemini TTS Provider ──────────────────────────────────────────────

let ai: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
  }
  return ai;
}

const TTS_TIMEOUT_MS = 35_000;
const VOICE_NAME = "Puck";

function createGeminiTtsProvider(model: string): TtsProvider {
  return {
    name: `gemini(${model})`,
    async generateSpeech(text, onChunk) {
      const result = await Promise.race([
        getClient().models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: VOICE_NAME },
              },
            },
          },
        }),
        new Promise<null>((_, reject) =>
          setTimeout(
            () => reject(new Error(`TTS timed out (${model})`)),
            TTS_TIMEOUT_MS,
          ),
        ),
      ]);

      if (!result) return false;

      let hasAudio = false;
      for (const candidate of result.candidates ?? []) {
        for (const part of candidate.content?.parts ?? []) {
          const audioData = part.inlineData?.data;
          if (audioData) {
            hasAudio = true;
            onChunk(audioData);
          }
        }
      }
      return hasAudio;
    },
  };
}

// ── Provider chain (tried in order) ──────────────────────────────────

const providers: TtsProvider[] = [
  createGeminiTtsProvider("gemini-2.5-pro-preview-tts"),
];

// ── Public API (unchanged signature) ─────────────────────────────────

const MAX_TTS_CHARS = 500;

/**
 * Generate speech audio via the TTS provider chain.
 * Tries each provider in order; stops at the first that delivers audio.
 * If all providers fail, resolves quietly — client will use Web Speech fallback.
 */
export async function streamSpeech(
  text: string,
  onAudioChunk?: (base64Audio: string) => void,
): Promise<string | null> {
  const input =
    text.length > MAX_TTS_CHARS
      ? text.slice(0, MAX_TTS_CHARS) + "..."
      : text;

  for (const provider of providers) {
    try {
      console.log(
        `[tts] Trying ${provider.name} (${input.length} chars)`,
      );
      const ok = await provider.generateSpeech(input, (chunk) =>
        onAudioChunk?.(chunk),
      );
      if (ok) {
        console.log(`[tts] ${provider.name} delivered audio`);
        return null;
      }
      console.warn(`[tts] ${provider.name} returned no audio, trying next`);
    } catch (err) {
      console.warn(`[tts] ${provider.name} failed:`, err instanceof Error ? err.message : err);
    }
  }

  console.warn("[tts] All providers failed — client will use Web Speech fallback");
  return null;
}
