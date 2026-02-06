import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "./types";

let ai: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
  }
  return ai;
}

export async function textToSpeech(
  text: string,
  voiceName = "Enceladus",
): Promise<string | null> {
  try {
    const response = await getClient().models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Say in a confident, energetic talk show host voice: ${text}`,
            },
          ],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const data =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return data ?? null;
  } catch (err) {
    console.error("[tts] Gemini TTS error:", err);
    return null;
  }
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
      maxOutputTokens: 500,
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
