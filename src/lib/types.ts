import type { Tables } from "./database.types";

export interface Streamer {
  id: string;
  name: string;
  personality: string;
  avatarUrl: string;
  model: "flash" | "pro";
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  category: string;
  isLive: boolean;
  thumbnailUrl: string;
  streamer: Streamer;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  username?: string;
}

export type MessageRow = Tables<"messages">;

export function dbRowToChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role as ChatMessage["role"],
    content: row.content,
    timestamp: new Date(row.created_at).getTime(),
    username: row.username ?? undefined,
  };
}

export type GestureReaction = "yes" | "no" | "uncertain";

export type EmoteCommand =
  // Core controls
  | "wink" | "blink" | "sleep" | "wake"
  // Core emotions
  | "happy" | "sad" | "surprised" | "thinking" | "angry" | "confused"
  | "excited" | "love" | "smug" | "crying" | "laughing" | "worried"
  | "nervous" | "proud" | "shy" | "bored" | "tired" | "disgusted"
  | "scared" | "determined"
  // Happy variants
  | "joy" | "bliss" | "grinning" | "cheerful" | "gleeful" | "delighted"
  | "euphoric" | "content" | "radiant" | "playful"
  // Sad variants
  | "heartbroken" | "melancholy" | "sobbing" | "gloomy" | "depressed"
  | "lonely" | "disappointed" | "weeping" | "moping" | "miserable"
  // Angry variants
  | "furious" | "irritated" | "annoyed" | "raging" | "grumpy" | "hostile"
  | "seething" | "frustrated" | "indignant" | "cranky"
  // Surprise variants
  | "shocked" | "amazed" | "astonished" | "startled" | "speechless"
  | "stunned" | "flabbergasted" | "awed" | "dumbfounded" | "bewildered"
  // Love/affection
  | "adoring" | "crushing" | "smitten" | "lovestruck" | "infatuated"
  | "yearning" | "charmed" | "devoted" | "tender" | "warm"
  // Smug/confident
  | "sassy" | "cocky" | "superior" | "victorious" | "triumphant"
  | "cheeky" | "mischievous" | "devious" | "brazen" | "sly"
  // Confused/thinking
  | "puzzled" | "pondering" | "curious" | "skeptical" | "questioning"
  | "perplexed" | "dubious" | "uncertain" | "clueless" | "contemplating"
  // Scared/nervous
  | "terrified" | "anxious" | "panicked" | "spooked" | "uneasy"
  | "dread" | "timid" | "petrified" | "jumpy" | "creepedout"
  // Cute/kawaii
  | "uwu" | "sparkles" | "kawaii" | "innocent" | "bubbly"
  | "adorable" | "puppy" | "cutesy" | "dainty" | "sweet"
  // Silly/goofy
  | "derp" | "goofy" | "zany" | "wacky" | "silly" | "bonkers"
  | "nutty" | "dorky" | "loopy" | "clowning"
  // Cool/confident
  | "cool" | "chill" | "suave" | "aloof" | "nonchalant" | "confident"
  | "smooth" | "composed" | "unfazed" | "stoic"
  // Tired/sleepy
  | "drowsy" | "exhausted" | "sleepy" | "yawning" | "fatigued"
  | "zonked" | "drained" | "lethargic" | "weary" | "dazed"
  // Disgust/discomfort
  | "grossed" | "repulsed" | "nauseated" | "cringing" | "uncomfortable"
  | "appalled" | "yikes" | "eww" | "ick" | "queasy"
  // Special/dramatic
  | "dead" | "mindblown" | "facepalm" | "shrug" | "judging" | "plotting"
  | "suspicious" | "pouting" | "flirty" | "daydreaming" | "zen" | "hyper"
  | "dramatic" | "sarcastic" | "starstruck" | "grateful" | "hopeful"
  | "nostalgic" | "peaceful" | "fierce";

export type MessagePriority = "normal" | "highlight" | "donation";

export interface BatchedChatMessage {
  id: string;
  username: string;
  content: string;
  timestamp: number;
  priority: MessagePriority;
  donationAmount?: number;
  donationCurrency?: string;
}

export interface ChatBatchRequest {
  batch: BatchedChatMessage[];
  streamerId: string;
  history: ChatMessage[];
}

export interface ChatResponse {
  response: string;
  gesture: GestureReaction;
  emote: EmoteCommand | null;
  audioData?: string; // base64 PCM, 24kHz mono 16-bit
}
