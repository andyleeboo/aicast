import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "./types";

let ai: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
  }
  return ai;
}

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

  const response = await getClient().models.generateContent({
    model: "gemini-3-flash-preview",
    contents,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 8192,
      temperature: 0.9,
    },
  });

  // Extract only the first text part — later parts may carry thoughtSignature
  // artifacts that cause duplicated/repeated text when concatenated
  const parts = response.candidates?.[0]?.content?.parts;
  const firstTextPart = parts?.find((p) => p.text)?.text ?? "";
  console.log("[chat] Gemini response:", JSON.stringify({ length: firstTextPart.length, partsCount: parts?.length }));
  if (!firstTextPart) {
    throw new Error("Empty response from Gemini");
  }
  // Cap response length to prevent runaway output from reaching clients
  const MAX_RESPONSE_CHARS = 1500;
  if (firstTextPart.length > MAX_RESPONSE_CHARS) {
    console.warn(`[chat] Response truncated from ${firstTextPart.length} to ${MAX_RESPONSE_CHARS} chars`);
    return firstTextPart.slice(0, MAX_RESPONSE_CHARS);
  }
  return firstTextPart;
}
