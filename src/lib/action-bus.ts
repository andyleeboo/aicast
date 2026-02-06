export interface ActionEvent {
  type: "gesture" | "emote";
  id: string; // e.g. "gesture:yes", "emote:wink"
}

type ActionListener = (event: ActionEvent) => void;

const listeners = new Set<ActionListener>();

export function emitAction(event: ActionEvent): void {
  listeners.forEach((fn) => fn(event));
}

export function subscribe(fn: ActionListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
