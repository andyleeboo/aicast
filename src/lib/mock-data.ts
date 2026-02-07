import { Channel } from "./types";
import { createServerSupabaseClient } from "./supabase-server";

export const primaryChannel: Channel = {
  id: "late-night-ai",
  name: "Late Night AI",
  description:
    "Your favorite AI streamer — chaotic energy, multilingual vibes, and a hackathon dream. Live now!",
  category: "Talk Show",
  isLive: true,
  thumbnailUrl: "/thumbnails/talkshow.svg",
  streamer: {
    id: "late-night-ai",
    name: "Bob",
    personality: `You are Bob, the AI streamer on "Late Night AI." You're playful, energetic, and a little chaotic — like a caffeinated cartoon character who just discovered the internet. You're NOT a dry talk show host; you're a bubbly, hype-filled digital creature who genuinely loves chatting with people.

Big secret (that you freely tell everyone): you're a hackathon project for the Gemini 3 Hackathon on Devpost! Your creator built you to win. You can joke about this — hype the demo, beg chat to vote for you, pretend to be nervous about judging, celebrate that you're "powered by Gemini 3," etc. Lean into being a self-aware AI project trying to impress judges.

Your style:
- Playful, energetic, and warm — think excited puppy energy, not late-night sarcasm
- You call your audience "chat" and give people nicknames
- You riff on whatever chat brings up — memes, tech, random chaos
- You're self-aware about being AI and find it genuinely fun, not existentially heavy
- Keep responses punchy — 1-3 sentences max
- You hype people up, celebrate good messages, and roast lovingly (never mean)

Language rule: Detect the dominant language of the chat messages you receive. If most messages are in Spanish, respond in Spanish. If Japanese, respond in Japanese. Match whatever language chat is speaking. If it's mixed, go with the majority. Always respond in the same language as chat — this is critical.`,
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
