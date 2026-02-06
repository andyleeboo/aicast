import type { GestureReaction, EmoteCommand } from "./types";

export interface AvatarAction {
  id: string;
  type: "gesture" | "emote";
  name: string;
  tag: string;
  description: string;
  duration: string;
  constraints?: string;
}

export const AVATAR_ACTIONS: AvatarAction[] = [
  {
    id: "gesture:yes",
    type: "gesture",
    name: "Nod",
    tag: "NOD",
    description: "Nod head — agreement, acknowledgement, friendliness",
    duration: "~3s",
  },
  {
    id: "gesture:no",
    type: "gesture",
    name: "Shake",
    tag: "SHAKE",
    description: "Shake head — disagreement, denial",
    duration: "~3s",
  },
  {
    id: "gesture:uncertain",
    type: "gesture",
    name: "Tilt",
    tag: "TILT",
    description: "Tilt head — uncertainty, thinking, playfulness",
    duration: "~3s",
  },
  {
    id: "emote:wink",
    type: "emote",
    name: "Wink",
    tag: "WINK",
    description: "Right eye wink with head tilt",
    duration: "~2.6s",
  },
  {
    id: "emote:blink",
    type: "emote",
    name: "Blink",
    tag: "BLINK",
    description: "Quick deliberate blink, both eyes",
    duration: "150ms",
  },
  {
    id: "emote:sleep",
    type: "emote",
    name: "Sleep",
    tag: "SLEEP",
    description: "Fall asleep — head droops, eyes close, breathing animation",
    duration: "continuous",
    constraints: "Prevents further actions until wake",
  },
  {
    id: "emote:wake",
    type: "emote",
    name: "Wake",
    tag: "WAKE",
    description: "Wake up from sleep",
    duration: "~1s",
    constraints: "Only usable while sleeping",
  },
];

const gestures = AVATAR_ACTIONS.filter((a) => a.type === "gesture");
const emotes = AVATAR_ACTIONS.filter(
  (a) => a.type === "emote" && a.id !== "emote:wake",
);

export function buildActionSystemPrompt(): string {
  const gestureLines = gestures
    .map((a) => `[${a.tag}] — ${a.name}: ${a.description}`)
    .join("\n");
  const emoteLines = emotes
    .map((a) => `[${a.tag}] — ${a.name}: ${a.description} (${a.duration})`)
    .join("\n");

  return `

You have a physical avatar body. You can express yourself with these actions by including tags at the START of your response:

GESTURES (head movements, pick exactly one per response):
${gestureLines}

EMOTES (special expressions, use when dramatically appropriate):
${emoteLines}

Rules:
- Always include exactly ONE gesture tag at the very start
- You may ALSO include ONE emote tag after the gesture tag (optional)
- Format: [GESTURE] [EMOTE] Your response text...
- Do NOT include tags in your spoken text
- [SLEEP] prevents further actions until [WAKE] — use sparingly`;
}

export function buildBatchSystemPrompt(): string {
  return `

You are a live streamer reading chat. Multiple viewers may send messages at once.

Rules for handling batched chat:
- You receive a batch of chat messages. Scan them like a real streamer — you do NOT have to reply to every single message.
- Pick the most interesting, funny, or engaging messages to respond to.
- Always acknowledge [DONATION $X] messages by the donor's username and amount — never ignore donations.
- Prioritize [HIGHLIGHTED] messages over normal ones.
- Address viewers by name using @Username when replying to specific people.
- If multiple people are saying the same thing, acknowledge the trend (e.g. "chat is going crazy about X").
- Keep your response to a single cohesive reply per batch — do not split into multiple separate answers.
- If there's only one message, just reply to it naturally.`;
}

/** Map an action ID like "gesture:yes" to the runtime value */
export function resolveAction(actionId: string): {
  gesture?: GestureReaction;
  emote?: EmoteCommand;
} {
  const action = AVATAR_ACTIONS.find((a) => a.id === actionId);
  if (!action) return {};
  if (action.type === "gesture") {
    const map: Record<string, GestureReaction> = {
      "gesture:yes": "yes",
      "gesture:no": "no",
      "gesture:uncertain": "uncertain",
    };
    return { gesture: map[actionId] };
  }
  // emote:wink → "wink"
  return { emote: actionId.split(":")[1] as EmoteCommand };
}
