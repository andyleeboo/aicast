import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/gemini";
import { getChannel } from "@/lib/mock-data";
import { ChatMessage, GestureReaction } from "@/lib/types";

const GESTURE_SUFFIX = `

IMPORTANT: At the very start of every response, include exactly one gesture tag on its own:
[NOD] - when agreeing, acknowledging, being friendly, or saying yes
[SHAKE] - when disagreeing, denying, or saying no
[TILT] - when uncertain, thinking, being playful, or pondering
Then continue your response normally after the tag. Do NOT include the tag in your spoken text.`;

const TAG_REGEX = /^\[(NOD|SHAKE|TILT)\]\s*/;

const tagToGesture: Record<string, GestureReaction> = {
  NOD: "yes",
  SHAKE: "no",
  TILT: "uncertain",
};

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

  const raw = await chat(
    messages,
    channel.streamer.personality + GESTURE_SUFFIX,
  );

  const match = raw.match(TAG_REGEX);
  const gesture: GestureReaction = match
    ? tagToGesture[match[1]] ?? "uncertain"
    : "uncertain";
  const response = match ? raw.replace(TAG_REGEX, "") : raw;

  return NextResponse.json({ response, gesture });
}
