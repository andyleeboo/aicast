import { NextRequest, NextResponse } from "next/server";
import { validateMessage } from "@/lib/moderation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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

  // Persist to Supabase — the SSE endpoint's chat-poller picks up new
  // messages and processes them inside the function context that has
  // action-bus listeners (needed for SSE delivery to clients).
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { error } = await supabase
      .from("messages")
      .insert({ channel_id: channelId, role: "user", content, username });
    if (error) {
      console.error("[chat] Supabase insert error:", error);
    }
  } else {
    console.warn("[chat] No Supabase client — message not persisted");
  }

  return NextResponse.json({ ok: true });
}
