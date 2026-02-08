import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { validateMessage } from "@/lib/moderation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { pushMessage, pushHistory, waitForFlush } from "@/lib/chat-queue";
import type { BatchedChatMessage } from "@/lib/types";

// Side-effect: registers the flush handler that wires queue → Gemini → SSE broadcast
import "@/lib/chat-queue-init";

// Extend Vercel function timeout so after() has enough time for the
// Gemini API call (default 10s is too short).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { username, content, channelId } = body as {
    username: string;
    content: string;
    channelId: string;
  };

  if (!username || !content || !channelId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  // Server-side moderation
  const check = validateMessage(content);
  if (!check.valid) {
    return NextResponse.json(
      { error: check.error ?? "Message rejected" },
      { status: 400 },
    );
  }

  // Push into server-side batch queue (will flush after debounce window)
  const batchMsg: BatchedChatMessage = {
    id: crypto.randomUUID(),
    username,
    content,
    timestamp: Date.now(),
    priority: "normal",
  };
  pushMessage(batchMsg);

  // Add user message to rolling history for Gemini context
  pushHistory({
    id: batchMsg.id,
    role: "user",
    content: `${username}: ${content}`,
    timestamp: batchMsg.timestamp,
  });

  // Persist to Supabase in background (fire-and-forget — don't block the response)
  const supabase = createServerSupabaseClient();
  if (supabase) {
    supabase
      .from("messages")
      .insert({ channel_id: channelId, role: "user", content, username })
      .then(({ error }) => {
        if (error) console.error("[chat] Supabase insert error:", error);
        else console.log("[chat] Saved user message to Supabase");
      });
  } else {
    console.warn("[chat] No Supabase client — message not persisted");
  }

  // Keep the serverless function alive until the batch queue flushes and
  // the Gemini call completes. Without this, Vercel freezes the function
  // after the response is sent, killing the setTimeout-based batch timer.
  after(waitForFlush);

  return NextResponse.json({ ok: true });
}
