import Link from "next/link";
import { getAllChannels } from "@/lib/mock-data";
import { ChannelCardThumbnail } from "@/components/channel-card-thumbnail";
import { ChannelCardAvatar } from "@/components/channel-card-avatar";
import type { GamePreview } from "@/components/channel-card-thumbnail";
import type { EmoteCommand } from "@/lib/types";

// ── Per-channel config ────────────────────────────────────────────────

interface ChannelConfig {
  /** Emote for the large thumbnail */
  emote: EmoteCommand;
  /** Different emote for the small avatar circle */
  avatarEmote: EmoteCommand;
  /** Head rotation [yaw, pitch] in radians for the avatar circle */
  avatarAngle: [number, number];
  gamePreview?: GamePreview;
  /** Offset avatar [x, y] in 3D units for non-game cards */
  avatarOffset?: [number, number];
}

const CHANNEL_CONFIG: Record<string, ChannelConfig> = {
  "late-night-ai": {
    emote: "excited",
    avatarEmote: "hyper",
    avatarAngle: [0.2, -0.1],
    gamePreview: {
      type: "hangman",
      data: {
        maskedWord: ["g", "e", "_", "i", "_", "i"],
        guessedLetters: ["g", "e", "i", "a", "r"],
        wrongGuesses: 2,
        maxWrong: 6,
        category: "Technology",
      },
    },
  },
  "midnight-code": {
    emote: "zen",
    avatarEmote: "peaceful",
    avatarAngle: [-0.15, 0.05],
    avatarOffset: [0.5, -0.15],
  },
  "arena-rage": {
    emote: "determined",
    avatarEmote: "fierce",
    avatarAngle: [0.1, 0.15],
    gamePreview: {
      type: "twentyq",
      data: {
        category: "thing",
        questionsAsked: 5,
        maxQuestions: 20,
        warmth: 3,
        history: [
          { question: "Is it alive?", answer: "NO", warmth: 1, isGuess: false },
          { question: "Can you hold it?", answer: "YES", warmth: 2, isGuess: false },
          { question: "Is it electronic?", answer: "YES", warmth: 3, isGuess: false },
        ],
        pendingQuestion: false,
      },
    },
  },
  "cozy-garden": {
    emote: "happy",
    avatarEmote: "warm",
    avatarAngle: [-0.2, -0.08],
    avatarOffset: [-0.4, 0.1],
  },
};

export default function Home() {
  const channels = getAllChannels();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
            <span className="text-xl font-bold">AICast</span>
          </Link>
          <span className="text-sm text-muted">AI Live Streaming</span>
        </div>
      </header>

      {/* Hero */}
      <div className="mx-auto max-w-5xl px-4 pt-10 pb-6">
        <h1 className="text-3xl font-bold sm:text-4xl">
          Live <span className="text-accent">AI</span> Channels
        </h1>
        <p className="mt-2 text-muted">
          Watch AI streamers live. Chat with them in real time. Powered by Gemini 3.
        </p>
      </div>

      {/* Channel grid */}
      <div className="mx-auto max-w-5xl px-4 pb-16">
        <div className="grid gap-6 sm:grid-cols-2">
          {channels.map((channel) => {
            const config = CHANNEL_CONFIG[channel.id] ?? { emote: "happy" as EmoteCommand, avatarEmote: "happy" as EmoteCommand, avatarAngle: [0, 0] as [number, number] };
            return (
              <Link
                key={channel.id}
                href={`/live/${channel.id}`}
                className="group overflow-hidden rounded-xl border border-border bg-surface transition-all hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5"
              >
                {/* Thumbnail — 3D avatar + game board (like a stream screenshot) */}
                <div className="relative">
                  <ChannelCardThumbnail
                    skinColor={channel.streamer.skinColor}
                    emote={config.emote}
                    gamePreview={config.gamePreview}
                    avatarOffset={config.avatarOffset}
                  />

                  {/* LIVE badge */}
                  {channel.isLive && (
                    <span className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded bg-live px-2 py-0.5 text-xs font-bold text-white uppercase">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                      </span>
                      Live
                    </span>
                  )}

                  {/* Category pill */}
                  <span className="absolute bottom-3 left-3 z-10 rounded-full bg-black/50 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
                    {channel.category}
                  </span>
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <ChannelCardAvatar
                      skinColor={channel.streamer.skinColor}
                      emote={config.avatarEmote}
                      headAngle={config.avatarAngle}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold group-hover:text-accent transition-colors">
                        {channel.name}
                      </p>
                      <p className="text-sm text-muted">{channel.streamer.name}</p>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-muted leading-relaxed">
                    {channel.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
