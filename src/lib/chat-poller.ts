/**
 * Polls Supabase for new user chat messages and processes them.
 *
 * Called from the SSE endpoint's keepalive interval to piggyback on
 * a timer context that is known to work on Vercel.
 */
import * as Sentry from "@sentry/nextjs";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  acquireProcessingLock,
  releaseProcessingLock,
  pushHistory,
  touchActivity,
  getLastActivityTimestamp,
} from "@/lib/chat-queue";
import { processChatBatch } from "@/lib/chat-queue-init";
import { emitAction } from "@/lib/action-bus";
import type { BatchedChatMessage } from "@/lib/types";

/** If chat has been quiet for this long, emit "ai-thinking" immediately. */
const SILENCE_THRESHOLD_MS = 8_000;

let lastPollAt = new Date().toISOString();
const processedIds = new Set<string>();

/** Check Supabase for new chat messages and process any found. */
export async function checkForNewMessages(channelId: string = "late-night-ai"): Promise<void> {
  if (!acquireProcessingLock()) return;

  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("role", "user")
      .eq("channel_id", channelId)
      .gt("created_at", lastPollAt)
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) {
      console.error("[chat-poller] Supabase error:", error.message);
      return;
    }
    if (!data || data.length === 0) return;

    const newMessages = data.filter((row) => !processedIds.has(row.id));
    if (newMessages.length === 0) return;

    lastPollAt = data[data.length - 1].created_at;
    for (const row of newMessages) processedIds.add(row.id);
    if (processedIds.size > 200) {
      const arr = [...processedIds];
      processedIds.clear();
      for (const id of arr.slice(-100)) processedIds.add(id);
    }

    console.log(`[chat-poller] Found ${newMessages.length} new message(s)`);

    const batch: BatchedChatMessage[] = newMessages.map((row) => ({
      id: row.id ?? crypto.randomUUID(),
      username: row.username ?? "Anonymous",
      content: row.content,
      timestamp: new Date(row.created_at).getTime(),
      priority: "normal" as const,
    }));

    for (const msg of batch) {
      pushHistory({
        id: msg.id,
        role: "user",
        content: `${msg.username}: ${msg.content}`,
        timestamp: msg.timestamp,
      });
    }

    // If chat was quiet, broadcast "thinking" immediately so clients see Bob react
    const silenceMs = Date.now() - getLastActivityTimestamp();
    if (silenceMs > SILENCE_THRESHOLD_MS) {
      emitAction({ type: "ai-thinking", id: "thinking-" + crypto.randomUUID(), channelId });
    }

    touchActivity();
    await processChatBatch(batch, channelId);
  } catch (err) {
    console.error("[chat-poller] Error polling channel:", channelId, err);
    Sentry.captureException(err, { tags: { module: "chat-poller", channelId } });
  } finally {
    releaseProcessingLock();
  }
}
