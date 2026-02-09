import type { BatchedChatMessage, ChatMessage } from "./types";

// Adaptive batching: short debounce that resets on each new message,
// hard cap so we never wait forever during a burst.
const DEBOUNCE_MS = 500; // flush 500ms after last message
const MAX_WAIT_MS = 2000; // never wait more than 2s from first message
const MAX_HISTORY = 30;

type FlushHandler = (batch: BatchedChatMessage[]) => Promise<void>;

interface ChatQueueState {
  queue: BatchedChatMessage[];
  history: ChatMessage[];
  debounceTimer: ReturnType<typeof setTimeout> | null;
  capTimer: ReturnType<typeof setTimeout> | null;
  processing: boolean;
  lockAcquiredAt: number;
  flushHandler: FlushHandler | null;
  lastActivityTimestamp: number;
}

const GLOBAL_KEY = "__chatQueueState" as const;

function getState(): ChatQueueState {
  const g = globalThis as unknown as Record<string, ChatQueueState>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      queue: [],
      history: [],
      debounceTimer: null,
      capTimer: null,
      processing: false,
      lockAcquiredAt: 0,
      flushHandler: null,
      lastActivityTimestamp: Date.now(),
    };
  }
  return g[GLOBAL_KEY];
}

function clearTimers(state: ChatQueueState) {
  if (state.debounceTimer) {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = null;
  }
  if (state.capTimer) {
    clearTimeout(state.capTimer);
    state.capTimer = null;
  }
}

function scheduleFlush() {
  const state = getState();

  // If currently processing, don't schedule — flushQueue re-checks after completion
  if (state.processing) return;

  // Reset debounce timer on every new message
  if (state.debounceTimer) clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(flushQueue, DEBOUNCE_MS);

  // Start hard cap timer on the first message in this batch window
  if (!state.capTimer) {
    state.capTimer = setTimeout(flushQueue, MAX_WAIT_MS);
  }
}

async function flushQueue() {
  const state = getState();
  clearTimers(state);

  if (state.processing || state.queue.length === 0) return;

  state.processing = true;
  const batch = state.queue.splice(0);

  try {
    if (state.flushHandler) {
      await state.flushHandler(batch);
    } else {
      console.warn("[chat-queue] No flush handler registered — batch dropped");
    }
  } catch (err) {
    console.error("[chat-queue] Flush handler error:", err);
  } finally {
    state.processing = false;
    state.lastActivityTimestamp = Date.now();
    // If new messages arrived during processing, schedule another flush
    if (state.queue.length > 0) {
      scheduleFlush();
    }
  }
}

export function pushMessage(msg: BatchedChatMessage): void {
  const state = getState();
  state.lastActivityTimestamp = Date.now();
  state.queue.push(msg);
  scheduleFlush();
}

export function pushHistory(msg: ChatMessage): void {
  const state = getState();
  state.history.push(msg);
  // Keep a rolling window
  if (state.history.length > MAX_HISTORY) {
    state.history.splice(0, state.history.length - MAX_HISTORY);
  }
}

export function getHistory(): ChatMessage[] {
  return getState().history;
}

export function setFlushHandler(fn: FlushHandler): void {
  getState().flushHandler = fn;
}

export function isProcessing(): boolean {
  return getState().processing;
}

/** Max time a lock can be held before it's considered stale (ms). */
const STALE_LOCK_MS = 30_000;

/** Try to acquire the processing lock. Returns true if acquired, false if already held. */
export function acquireProcessingLock(): boolean {
  const state = getState();
  if (state.processing) {
    // Force-release stale locks (e.g. Gemini call hung, Vercel killed process)
    const elapsed = Date.now() - state.lockAcquiredAt;
    if (elapsed > STALE_LOCK_MS) {
      console.warn(`[chat-queue] Force-releasing stale lock held for ${(elapsed / 1000).toFixed(1)}s`);
      state.processing = false;
    } else {
      return false;
    }
  }
  state.processing = true;
  state.lockAcquiredAt = Date.now();
  return true;
}

/** Release the processing lock and reschedule flush if messages queued. */
export function releaseProcessingLock(): void {
  const state = getState();
  state.processing = false;
  if (state.queue.length > 0) {
    scheduleFlush();
  }
}

/**
 * Directly flush the queue. Called from Next.js after() to ensure the
 * batch processes even when Vercel freezes timers after the response.
 *
 * Force-clears the processing lock first — on Vercel a previous invocation
 * may have been killed mid-flush, leaving the lock permanently stuck.
 */
export async function waitForFlush(): Promise<void> {
  const state = getState();
  console.log("[chat-queue] after() triggered — flushing directly", {
    queueLen: state.queue.length,
    processing: state.processing,
  });
  // Force-clear stale lock from a previously killed invocation
  state.processing = false;
  clearTimers(state);
  await flushQueue();
}

export function getLastActivityTimestamp(): number {
  return getState().lastActivityTimestamp;
}

export function touchActivity(): void {
  getState().lastActivityTimestamp = Date.now();
}
