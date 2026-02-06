import type { BatchedChatMessage, ChatMessage } from "./types";

const BATCH_WINDOW_MS = 3000;
const MAX_HISTORY = 30;

type FlushHandler = (batch: BatchedChatMessage[]) => Promise<void>;

interface ChatQueueState {
  queue: BatchedChatMessage[];
  history: ChatMessage[];
  timer: ReturnType<typeof setTimeout> | null;
  processing: boolean;
  flushHandler: FlushHandler | null;
}

const GLOBAL_KEY = "__chatQueueState" as const;

function getState(): ChatQueueState {
  const g = globalThis as unknown as Record<string, ChatQueueState>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      queue: [],
      history: [],
      timer: null,
      processing: false,
      flushHandler: null,
    };
  }
  return g[GLOBAL_KEY];
}

function scheduleFlush() {
  const state = getState();
  if (state.timer) return; // already scheduled
  state.timer = setTimeout(flushQueue, BATCH_WINDOW_MS);
}

async function flushQueue() {
  const state = getState();
  state.timer = null;

  if (state.processing || state.queue.length === 0) return;

  state.processing = true;
  const batch = state.queue.splice(0);

  try {
    if (state.flushHandler) {
      await state.flushHandler(batch);
    }
  } catch (err) {
    console.error("[chat-queue] Flush handler error:", err);
  } finally {
    state.processing = false;
    // If new messages arrived during processing, schedule another flush
    if (state.queue.length > 0) {
      scheduleFlush();
    }
  }
}

export function pushMessage(msg: BatchedChatMessage): void {
  const state = getState();
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
