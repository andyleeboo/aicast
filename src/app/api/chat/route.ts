import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/gemini";
import { getChannel } from "@/lib/mock-data";
import { ChatMessage } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { message, streamerId, history } = (await req.json()) as {
    message: string;
    streamerId: string;
    history: ChatMessage[];
  };

  const channel = getChannel(streamerId);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const messages: ChatMessage[] = [
    ...history,
    {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: Date.now(),
    },
  ];

  const response = await chat(messages, channel.streamer.personality);

  return NextResponse.json({ response });
}
