import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/gemini";
import { getChannel } from "@/lib/mock-data";
import { ChatMessage, GestureReaction, EmoteCommand } from "@/lib/types";
import { buildActionSystemPrompt } from "@/lib/avatar-actions";
import { emitAction } from "@/lib/action-bus";

const GESTURE_TAGS = ["NOD", "SHAKE", "TILT"] as const;
const EMOTE_TAGS = ["WINK", "BLINK", "SLEEP"] as const;

const TAG_REGEX = /^\[([A-Z]+)\]\s*/;

const tagToGesture: Record<string, GestureReaction> = {
  NOD: "yes",
  SHAKE: "no",
  TILT: "uncertain",
};

const tagToEmote: Record<string, EmoteCommand> = {
  WINK: "wink",
  BLINK: "blink",
  SLEEP: "sleep",
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
    channel.streamer.personality + buildActionSystemPrompt(),
  );

  // Parse leading tags: [GESTURE] [EMOTE] response text...
  let remaining = raw;
  let gesture: GestureReaction = "uncertain";
  let emote: EmoteCommand | null = null;

  // First tag — expect gesture
  const firstMatch = remaining.match(TAG_REGEX);
  if (firstMatch) {
    const tag = firstMatch[1];
    if (GESTURE_TAGS.includes(tag as (typeof GESTURE_TAGS)[number])) {
      gesture = tagToGesture[tag];
      remaining = remaining.replace(TAG_REGEX, "");
    } else if (EMOTE_TAGS.includes(tag as (typeof EMOTE_TAGS)[number])) {
      // AI put an emote first — accept it
      emote = tagToEmote[tag];
      remaining = remaining.replace(TAG_REGEX, "");
    }
  }

  // Second tag — expect emote (or gesture if first was emote)
  const secondMatch = remaining.match(TAG_REGEX);
  if (secondMatch) {
    const tag = secondMatch[1];
    if (!emote && EMOTE_TAGS.includes(tag as (typeof EMOTE_TAGS)[number])) {
      emote = tagToEmote[tag];
      remaining = remaining.replace(TAG_REGEX, "");
    } else if (
      gesture === "uncertain" &&
      GESTURE_TAGS.includes(tag as (typeof GESTURE_TAGS)[number])
    ) {
      gesture = tagToGesture[tag];
      remaining = remaining.replace(TAG_REGEX, "");
    }
  }

  const response = remaining.trim();

  // Emit to action bus for SSE sync
  emitAction({ type: "gesture", id: `gesture:${gesture}` });
  if (emote) {
    emitAction({ type: "emote", id: `emote:${emote}` });
  }

  return NextResponse.json({ response, gesture, emote });
}
