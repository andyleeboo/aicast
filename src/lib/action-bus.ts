export interface ActionEvent {
  type: "gesture" | "emote" | "skill" | "ai-response" | "ai-thinking" | "ai-audio" | "ai-audio-chunk" | "ai-audio-end" | "maintenance-mode";
  id: string; // e.g. "gesture:yes", "emote:wink", "skill:dramatic-zoom", or unique response id
  response?: string;
  audioData?: string | null;
  gesture?: string;
  emote?: string | null;
  skillId?: string | null;
}

type ActionListener = (event: ActionEvent) => void;

// Use globalThis to ensure a single shared Set across all route modules
// (Turbopack dev can isolate module scopes per route)
const GLOBAL_KEY = "__actionBusListeners" as const;

function getListeners(): Set<ActionListener> {
  const g = globalThis as unknown as Record<string, Set<ActionListener>>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Set<ActionListener>();
  }
  return g[GLOBAL_KEY];
}

export function emitAction(event: ActionEvent): void {
  getListeners().forEach((fn) => fn(event));
}

export function subscribe(fn: ActionListener): () => void {
  const listeners = getListeners();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getListenerCount(): number {
  return getListeners().size;
}

// ── Time-windowed viewer tracking (serverless-safe) ──────────────────
// Unlike listener count which is per-instance, this uses timestamps
// so stale entries can be pruned even if cancel() never fires.

const VIEWER_KEY = "__viewerTimestamps" as const;
const VIEWER_TTL_MS = 60_000; // Consider a viewer gone after 60s without heartbeat

function getViewerMap(): Map<string, number> {
  const g = globalThis as unknown as Record<string, Map<string, number>>;
  if (!g[VIEWER_KEY]) {
    g[VIEWER_KEY] = new Map<string, number>();
  }
  return g[VIEWER_KEY];
}

/** Register or refresh a viewer's heartbeat timestamp. */
export function touchViewer(viewerId: string): void {
  getViewerMap().set(viewerId, Date.now());
}

/** Remove a viewer explicitly (on SSE disconnect). */
export function removeViewer(viewerId: string): void {
  getViewerMap().delete(viewerId);
}

/** Count viewers seen within the TTL window, pruning stale entries. */
export function getViewerCount(): number {
  const map = getViewerMap();
  const cutoff = Date.now() - VIEWER_TTL_MS;
  for (const [id, ts] of map) {
    if (ts < cutoff) map.delete(id);
  }
  return map.size;
}
