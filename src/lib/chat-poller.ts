/**
 * Side-effect module: polls Supabase for new user chat messages and
 * processes them inside the SSE endpoint's function context.
 *
 * On Vercel serverless, the POST /api/chat handler and the SSE endpoint
 * run in separate function invocations with separate globalThis. The
 * in-memory action-bus only has listeners in the SSE endpoint, so chat
 * messages must be processed HERE (inside the SSE invocation) for
 * emitAction() to reach connected clients.
 *
 * Import this module from the SSE route to auto-start polling.
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
const GLOBAL_KEY = "__chatPollerState" as const;

interface PollerState {
  timer: ReturnType<typeof setInterval> | null;
  lastPollAt: string; // ISO timestamp
  processedIds: Set<string>;
}

function getState(): PollerState {
  const g = globalThis as unknown as Record<string, PollerState>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      timer: null,
      lastPollAt: new Date().toISOString(),
      processedIds: new Set(),
    };
  }
  return g[GLOBAL_KEY];
}

let pollCount = 0;

async function pollForMessages() {
  pollCount++;
  // Log every 10th poll to avoid spam but confirm the interval is firing
  if (pollCount % 10 === 1) {
    console.log(`[chat-poller] Poll #${pollCount}`);
  }

  // Don't overlap with proactive speech or another poll cycle
  if (!acquireProcessingLock()) {
    return;
  }

  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) {
      console.warn("[chat-poller] No Supabase client");
      return;
    }

    const state = getState();
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("role", "user")
      .gt("created_at", state.lastPollAt)
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) {
      console.error("[chat-poller] Supabase query error:", error);
      return;
    }
    if (!data || data.length === 0) return;

    // Deduplicate against previously processed messages
    const newMessages = data.filter((row) => !state.processedIds.has(row.id));
    if (newMessages.length === 0) return;

    // Update bookmark
    state.lastPollAt = data[data.length - 1].created_at;
    for (const row of newMessages) {
      state.processedIds.add(row.id);
    }

    // Keep dedup set bounded (last 200 IDs)
    if (state.processedIds.size > 200) {
      const arr = [...state.processedIds];
      state.processedIds = new Set(arr.slice(-100));
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

// Auto-start on import
const state = getState();
if (!state.timer) {
  state.timer = setInterval(pollForMessages, POLL_INTERVAL_MS);
  console.log("[chat-poller] Started (checking every 3s)");
}
