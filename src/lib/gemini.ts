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
  const firstPart = response.candidates?.[0]?.content?.parts?.[0];
  const text = firstPart?.text ?? "";
  console.log("[chat] Gemini raw response:", JSON.stringify({ text, partsCount: response.candidates?.[0]?.content?.parts?.length }));
  if (!text) {
    throw new Error(`Empty response from Gemini (text=${JSON.stringify(text)})`);
  }
  return text;
}
