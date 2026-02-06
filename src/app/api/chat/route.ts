import { NextRequest, NextResponse } from "next/server";
import { chat, textToSpeech } from "@/lib/gemini";
import { getChannelFromDB } from "@/lib/mock-data";
import {
  ChatMessage,
  GestureReaction,
  EmoteCommand,
  BatchedChatMessage,
} from "@/lib/types";
import {
  buildActionSystemPrompt,
  buildBatchSystemPrompt,
} from "@/lib/avatar-actions";
import { emitAction } from "@/lib/action-bus";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { validateMessage } from "@/lib/moderation";

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

const PRIORITY_ORDER: Record<string, number> = {
  donation: 0,
  highlight: 1,
  normal: 2,
};

function formatBatchForAI(batch: BatchedChatMessage[]): string {
  const sorted = [...batch].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2),
  );

  const lines = sorted.map((msg) => {
    let prefix = "";
    if (msg.priority === "donation" && msg.donationAmount) {
      prefix = `[DONATION $${msg.donationAmount}] `;
    } else if (msg.priority === "highlight") {
      prefix = "[HIGHLIGHTED] ";
    }
    return `${prefix}${msg.username}: ${msg.content}`;
  });

  return `[CHAT BATCH - ${batch.length} message(s)]\n${lines.join("\n")}`;
}

function parseTags(raw: string) {
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

  return { response: remaining.trim(), gesture, emote };
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Detect batch vs legacy format
  const isBatch = Array.isArray(body.batch);
  const streamerId: string = body.streamerId;
  const history: ChatMessage[] = body.history ?? [];

  const channel = await getChannelFromDB(streamerId);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  // Server-side moderation for batch messages
  if (isBatch) {
    const batch: BatchedChatMessage[] = body.batch;
    for (const msg of batch) {
      const check = validateMessage(msg.content);
      if (!check.valid) {
        return NextResponse.json(
          { error: check.error ?? "Message rejected" },
          { status: 400 },
        );
      }
    }
  }

  let messages: ChatMessage[];
  let systemPrompt: string;

  if (isBatch) {
    const batch: BatchedChatMessage[] = body.batch;
    const batchText = formatBatchForAI(batch);

    messages = [
      ...history,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: batchText,
        timestamp: Date.now(),
      },
    ];

    systemPrompt =
      channel.streamer.personality +
      buildBatchSystemPrompt() +
      buildActionSystemPrompt();
  } else {
    // Legacy single-message format
    const message: string = body.message;
    messages = [
      ...history,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        timestamp: Date.now(),
      },
    ];

    systemPrompt =
      channel.streamer.personality + buildActionSystemPrompt();
  }

  let raw: string;
  try {
    raw = await chat(messages, systemPrompt);
  } catch (err) {
    console.error("[chat] Gemini API error:", err);
    return NextResponse.json(
      { error: "AI service unavailable" },
      { status: 502 },
    );
  }

  const { response, gesture, emote } = parseTags(raw);

  // Generate speech audio (graceful degradation — null on failure)
  const audioData = await textToSpeech(response);

  // Insert AI response into messages table
  const supabase = createServerSupabaseClient();
  await supabase.from("messages").insert({
    channel_id: streamerId,
    role: "assistant",
    content: response,
  });

  // Emit to action bus for SSE sync
  emitAction({ type: "gesture", id: `gesture:${gesture}` });
  if (emote) {
    emitAction({ type: "emote", id: `emote:${emote}` });
  }

  return NextResponse.json({ response, gesture, emote, audioData });
}
