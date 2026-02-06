/**
 * Side-effect module: Bob performs random idle expressions when nobody is chatting.
 * Broadcasts to all viewers via the action-bus SSE.
 */
import { emitAction } from "@/lib/action-bus";
import type { GestureReaction, EmoteCommand } from "@/lib/types";

const IDLE_GESTURES: GestureReaction[] = ["yes", "no", "uncertain"];

const IDLE_EMOTES: EmoteCommand[] = [
  "thinking",
  "happy",
  "blink",
  "cool",
  "curious",
  "bored",
  "content",
  "chill",
  "wink",
  "smug",
  "excited",
  "confused",
  "shrug",
  "derp",
  "shy",
  "sparkles",
  "pondering",
  "daydreaming",
  "nonchalant",
  "playful",
  "sassy",
  "goofy",
  "sleepy",
];

// Subset of skills safe for idle use (no extreme zooms or positions)
const IDLE_SKILLS: string[] = [
  "skill:chill-lean",
  "skill:thinking-corner",
  "skill:float-up",
  "skill:smol-shy",
  "skill:pull-back",
  "skill:lean-in",
];

const MIN_INTERVAL_MS = 8_000;
const MAX_INTERVAL_MS = 20_000;

interface IdleState {
  timer: ReturnType<typeof setTimeout> | null;
  paused: boolean;
}

const GLOBAL_KEY = "__idleBehaviorState" as const;

function getState(): IdleState {
  const g = globalThis as unknown as Record<string, IdleState>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { timer: null, paused: false };
  }
  return g[GLOBAL_KEY];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function scheduleNext() {
  const state = getState();
  if (state.timer) clearTimeout(state.timer);

  const delay = randomInt(MIN_INTERVAL_MS, MAX_INTERVAL_MS);
  state.timer = setTimeout(() => {
    if (state.paused) {
      scheduleNext();
      return;
    }

    // 55% emote, 20% gesture, 10% both, 15% performance skill
    const roll = Math.random();
    if (roll < 0.55) {
      emitAction({
        type: "emote",
        id: `emote:${pick(IDLE_EMOTES)}`,
      });
    } else if (roll < 0.75) {
      emitAction({
        type: "gesture",
        id: `gesture:${pick(IDLE_GESTURES)}`,
      });
    } else if (roll < 0.85) {
      emitAction({
        type: "gesture",
        id: `gesture:${pick(IDLE_GESTURES)}`,
      });
      setTimeout(() => {
        emitAction({
          type: "emote",
          id: `emote:${pick(IDLE_EMOTES)}`,
        });
      }, 500);
    } else {
      emitAction({
        type: "skill",
        id: pick(IDLE_SKILLS),
      });
    }

    scheduleNext();
  }, delay);
}

/** Pause idle behavior (e.g. while Bob is responding to chat) */
export function pauseIdle() {
  getState().paused = true;
}

/** Resume idle behavior after Bob finishes responding */
export function resumeIdle() {
  getState().paused = false;
}

// Auto-start on import
scheduleNext();
