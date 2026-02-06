import { GestureReaction } from "@/lib/types";

export interface QuaternionSample {
  t: number;
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface GestureRecording {
  id: string;
  label: string;
  duration: number;
  samples: QuaternionSample[];
}

const cache = new Map<string, GestureRecording>();

const gestureFiles: Record<GestureReaction, string> = {
  yes: "/gestures/recording-yes.json",
  no: "/gestures/recording-no.json",
  uncertain: "/gestures/recording-uncertain.json",
};

export async function fetchGesture(
  name: GestureReaction,
): Promise<GestureRecording> {
  const cached = cache.get(name);
  if (cached) return cached;

  const res = await fetch(gestureFiles[name]);
  const data: GestureRecording = await res.json();
  cache.set(name, data);
  return data;
}
