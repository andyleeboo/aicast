/**
 * Polls Supabase for new user chat messages and processes them inside
 * the SSE endpoint's function context.
 *
 * On Vercel serverless, the POST /api/chat handler and the SSE endpoint
 * run in separate function invocations with separate globalThis. The
 * in-memory action-bus only has listeners in the SSE endpoint, so chat
 * messages must be processed HERE (inside the SSE invocation) for
 * emitAction() to reach connected clients.
 *
 * Call `startChatPoller()` from the SSE stream's start() callback.
 */
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  acquireProcessingLock,
  releaseProcessingLock,
  pushHistory,
  touchActivity,
} from "@/lib/chat-queue";
import { processChatBatch } from "@/lib/chat-queue-init";
import type { BatchedChatMessage } from "@/lib/types";

const POLL_INTERVAL_MS = 3_000;

let lastPollAt = new Date().toISOString();
const processedIds = new Set<string>();

async function pollForMessages() {
  // Don't overlap with proactive speech or another poll cycle
  if (!acquireProcessingLock()) return;

  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("role", "user")
      .gt("created_at", lastPollAt)
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) {
      console.error("[chat-poller] Supabase query error:", error);
      return;
    }
    if (!data || data.length === 0) return;

    // Deduplicate against previously processed messages
    const newMessages = data.filter((row) => !processedIds.has(row.id));
    if (newMessages.length === 0) return;

    // Update bookmark
    lastPollAt = data[data.length - 1].created_at;
    for (const row of newMessages) {
      processedIds.add(row.id);
    }

    // Keep dedup set bounded
    if (processedIds.size > 200) {
      const arr = [...processedIds];
      processedIds.clear();
      for (const id of arr.slice(-100)) processedIds.add(id);
    }

    console.log(`[chat-poller] Found ${newMessages.length} new message(s)`);

    // Convert DB rows to batch format
    const batch: BatchedChatMessage[] = newMessages.map((row) => ({
      id: row.id ?? crypto.randomUUID(),
      username: row.username ?? "Anonymous",
      content: row.content,
      timestamp: new Date(row.created_at).getTime(),
      priority: "normal" as const,
    }));

    // Add to in-memory history for Gemini context
    for (const msg of batch) {
      pushHistory({
        id: msg.id,
        role: "user",
        content: `${msg.username}: ${msg.content}`,
        timestamp: msg.timestamp,
      });
    }

    touchActivity();

    // Process the batch (Gemini → action-bus → TTS)
    await processChatBatch(batch);
  } catch (err) {
    console.error("[chat-poller] Poll error:", err);
  } finally {
    releaseProcessingLock();
  }
}

/**
 * Start the chat poller. Returns cleanup function to clear the interval.
 * Must be called inside the SSE stream's start() callback.
 */
export function startChatPoller(): () => void {
  // Reset bookmark to now so we don't pick up old messages
  lastPollAt = new Date().toISOString();
  const timer = setInterval(pollForMessages, POLL_INTERVAL_MS);
  console.log("[chat-poller] Started (checking every 3s)");
  return () => clearInterval(timer);
}
