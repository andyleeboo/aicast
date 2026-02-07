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
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const response = await getClient().models.generateContent({
    model: "gemini-3-flash-preview",
    contents,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 8192,
      temperature: 0.9,
    },
  });

  const text = response.text;
  console.log("[chat] Gemini raw response:", JSON.stringify({ text, candidates: response.candidates }));
  if (!text) {
    throw new Error(`Empty response from Gemini (text=${JSON.stringify(text)})`);
  }
  return text;
}
