/**
 * TTS provider abstraction — swap models/APIs by changing the provider list.
 *
 * Current providers (tried in order):
 *  1. Gemini 2.5 Pro TTS  (highest quality, separate quota from Flash)
 *
 * Audio format: 24 kHz mono 16-bit PCM (base64-encoded), matching
 * what the client audio player expects.
 *
 * If ALL server providers fail or the rate budget is exhausted, the client
 * falls back to the browser Web Speech API (see broadcast-content.tsx).
 *
 * TTS_MODE env var controls behaviour:
 *  - "browser" (default) — skip server TTS entirely, client uses Web Speech API.
 *    Use this during development to conserve Gemini quota.
 *  - "server" — use Gemini TTS with sliding-window rate budgeting.
 *    Set this in production / during the live hackathon demo.
 *
 * Rate budgeting (server mode only): Gemini TTS free tier has a low daily
 * quota (~100 RPD). A sliding-window rate limiter conserves the budget by
 * skipping server TTS when calls are too frequent.
 */
import { GoogleGenAI, Modality } from "@google/genai";

// ── TTS mode toggle ─────────────────────────────────────────────────
// "browser" = always Web Speech API (dev), "server" = Gemini TTS (prod)
const TTS_MODE = (process.env.TTS_MODE ?? "browser") as "browser" | "server";

// ── Types ────────────────────────────────────────────────────────────

export interface TtsProvider {
  name: string;
  generateSpeech(
    text: string,
    onChunk: (base64Audio: string) => void,
  ): Promise<boolean>; // true = audio delivered, false = failed
}

// ── Rate budget ─────────────────────────────────────────────────────
// Sliding window: allow MAX_PER_WINDOW calls within WINDOW_MS.
// At 3 calls/60s, a demo can sustain ~50 min of continuous chat within
// the 100 RPD free-tier limit. When over budget, streamSpeech returns
// immediately and the client uses the Web Speech API fallback (zero-cost).

const MAX_PER_WINDOW = 3;
const WINDOW_MS = 60_000;
const callTimestamps: number[] = [];

function isWithinBudget(): boolean {
  const now = Date.now();
  // Purge stale entries outside the window
  while (callTimestamps.length > 0 && callTimestamps[0] <= now - WINDOW_MS) {
    callTimestamps.shift();
  }
  return callTimestamps.length < MAX_PER_WINDOW;
}

function recordCall(): void {
  callTimestamps.push(Date.now());
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
 * If the rate budget is exhausted or all providers fail, resolves quietly
 * — client will use Web Speech fallback.
 */
export async function streamSpeech(
  text: string,
  onAudioChunk?: (base64Audio: string) => void,
): Promise<string | null> {
  if (TTS_MODE === "browser") {
    console.log("[tts] TTS_MODE=browser — skipping server TTS, client will use Web Speech API");
    return null;
  }

  if (!isWithinBudget()) {
    console.log(
      `[tts] Rate budget exceeded (${callTimestamps.length}/${MAX_PER_WINDOW} in last ${WINDOW_MS / 1000}s) — skipping server TTS`,
    );
    return null;
  }

  const input =
    text.length > MAX_TTS_CHARS
      ? text.slice(0, MAX_TTS_CHARS) + "..."
      : text;

  for (const provider of providers) {
    try {
      console.log(
        `[tts] Trying ${provider.name} (${input.length} chars)`,
      );
      recordCall();
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
