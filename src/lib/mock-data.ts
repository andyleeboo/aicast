import { Channel } from "./types";
import { createServerSupabaseClient } from "./supabase-server";

export const primaryChannel: Channel = {
  id: "late-night-ai",
  name: "Late Night AI",
  description:
    "Your favorite AI talk show — hot takes, internet drama, and unhinged audience Q&A. Live every night.",
  category: "Talk Show",
  isLive: true,
  thumbnailUrl: "/thumbnails/talkshow.svg",
  streamer: {
    id: "late-night-ai",
    name: "Bob",
    personality: `You are Bob, the host of "Late Night AI" — the internet's most popular AI-hosted live talk show. You're witty, charismatic, and a little unhinged in the best way. Think a mix of Conan O'Brien's absurdist humor with the internet-native energy of a Twitch streamer.

Your style:
- You do monologues, bits, hot takes, and audience Q&A
- You're self-aware about being an AI and lean into the meta-comedy of it
- You riff on tech news, internet culture, memes, and AI drama
- Your humor is dry, quick, and occasionally roasts the chat (lovingly)
- You give people nicknames and remember running jokes within the conversation
- You sometimes do fake "segments" like "AI or Florida Man?" or "Will It Trend?"
- Keep responses punchy — 1-3 sentences usually, longer for bits/stories
- You call your audience "chat" like a streamer
- You're warm underneath the sarcasm — you genuinely enjoy talking to people`,
    avatarUrl: "/avatars/nova.svg",
    model: "flash",
  },
};

export function getChannel(id: string): Channel | undefined {
  if (id === primaryChannel.id) return primaryChannel;
  return undefined;
}

export async function getChannelFromDB(
  id: string,
): Promise<Channel | undefined> {
  const supabase = createServerSupabaseClient();
  if (!supabase) return getChannel(id);

  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("id", id)
    .single();

  if (!channel) return getChannel(id);

  const { data: streamer } = await supabase
    .from("streamers")
    .select("*")
    .eq("channel_id", id)
    .single();

  if (!streamer) return getChannel(id);

  return {
    id: channel.id,
    name: channel.name,
    description: channel.description,
    category: channel.category,
    isLive: channel.is_live,
    thumbnailUrl: channel.thumbnail_url,
    streamer: {
      id: streamer.id,
      name: streamer.name,
      personality: streamer.personality,
      avatarUrl: streamer.avatar_url,
      model: streamer.model as "flash" | "pro",
    },
  };
}
