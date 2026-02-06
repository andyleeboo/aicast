export interface ActionEvent {
  type: "gesture" | "emote" | "ai-response";
  id: string; // e.g. "gesture:yes", "emote:wink", or unique response id
  response?: string;
  audioData?: string | null;
  gesture?: string;
  emote?: string | null;
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
