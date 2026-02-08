import { NextRequest, NextResponse } from "next/server";
import { validateMessage } from "@/lib/moderation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { emitAction } from "@/lib/action-bus";
import { pushHistory } from "@/lib/chat-queue";
import { processChatBatch } from "@/lib/chat-queue-init";
import type { DonationTier } from "@/lib/types";

const TIER_COSTS: Record<DonationTier, number> = {
  blue: 2,
  gold: 10,
  red: 50,
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { username, content, tier, channelId } = body as {
    username: string;
    content: string;
    tier: DonationTier;
    channelId: string;
  };

  if (!username || !content || !tier || !channelId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const amount = TIER_COSTS[tier];
  if (!amount) {
    return NextResponse.json(
      { error: "Invalid donation tier" },
      { status: 400 },
    );
  }

  const check = validateMessage(content);
  if (!check.valid) {
    return NextResponse.json(
      { error: check.error ?? "Message rejected" },
      { status: 400 },
    );
  }

  const msgId = crypto.randomUUID();

  // Persist to Supabase (fire-and-forget)
  const supabase = createServerSupabaseClient();
  if (supabase) {
    supabase
      .from("messages")
      .insert({ channel_id: channelId, role: "user", content, username })
      .then(({ error }) => {
        if (error) console.error("[donation] Supabase insert error:", error.message);
      });
  }

  // Broadcast donation event to all viewers via SSE
  emitAction({
    type: "donation",
    id: msgId,
    donationTier: tier,
    donationAmount: amount,
    donationUsername: username,
    donationContent: content,
  });

  // Push to history so Bob has context
  pushHistory({
    id: msgId,
    role: "user",
    content: `${username}: ${content}`,
    timestamp: Date.now(),
  });

  // Immediately process — Bob reacts NOW (bypasses batch queue)
  await processChatBatch([
    {
      id: msgId,
      username,
      content,
      timestamp: Date.now(),
      priority: "donation",
      donationAmount: amount,
      donationTier: tier,
    },
  ]);

  return NextResponse.json({ ok: true });
}
