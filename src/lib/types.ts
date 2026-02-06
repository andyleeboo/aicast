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
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}
