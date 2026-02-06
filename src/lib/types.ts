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
  viewerCount: number;
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

export type GestureReaction = "yes" | "no" | "uncertain";

export type EmoteCommand = "wink" | "blink" | "sleep" | "wake";

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
