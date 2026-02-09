import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "./types";

let ai: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
  }
  return ai;
}

// Model fallback chain: try Gemini 3 Flash first (hackathon requirement),
// fall back to 2.5 Flash if 3 is overloaded/unavailable.
const CHAT_MODELS = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
];

export async function chat(
  messages: ChatMessage[],
  systemPrompt: string,
): Promise<string> {
  let contents = messages.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  // Gemini requires at least one content entry — proactive speech may have empty history
  if (contents.length === 0) {
    contents = [{ role: "user" as const, parts: [{ text: "(No chat yet — start talking!)" }] }];
  }

  // Gemini 2.5 requires the last content to be user role for generateContent
  if (contents[contents.length - 1].role !== "user") {
    contents.push({ role: "user" as const, parts: [{ text: "(continue)" }] });
  }

  for (const model of CHAT_MODELS) {
    try {
      const response = await getClient().models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 8192,
          temperature: 0.9,
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      const firstTextPart = parts?.find((p) => p.text)?.text ?? "";
      console.log(`[chat] ${model} response:`, JSON.stringify({ length: firstTextPart.length, partsCount: parts?.length, finishReason: response.candidates?.[0]?.finishReason }));

      if (!firstTextPart) {
        console.warn(`[chat] Empty response from ${model} — trying next model`);
        continue;
      }

      return firstTextPart;
    } catch (err) {
      console.warn(`[chat] ${model} failed:`, err instanceof Error ? err.message : err);
    }
  }

  throw new Error("All chat models failed");
}
