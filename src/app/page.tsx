import Link from "next/link";
import { getAllChannels } from "@/lib/mock-data";

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
          {channels.map((channel) => (
            <Link
              key={channel.id}
              href={`/live/${channel.id}`}
              className="group overflow-hidden rounded-xl border border-border bg-surface transition-all hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5"
            >
              {/* Thumbnail area */}
              <div
                className="relative flex h-48 items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, rgb(${channel.streamer.skinColor.map((c) => Math.round(c * 80)).join(",")}) 0%, rgb(${channel.streamer.hairColor.map((c) => Math.round(c * 120)).join(",")}) 100%)`,
                }}
              >
                {/* Streamer initial */}
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-4xl font-bold text-white backdrop-blur-sm">
                  {channel.streamer.name[0]}
                </div>

                {/* LIVE badge */}
                {channel.isLive && (
                  <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded bg-live px-2 py-0.5 text-xs font-bold text-white uppercase">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    Live
                  </span>
                )}

                {/* Category pill */}
                <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
                  {channel.category}
                </span>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{
                      background: `linear-gradient(135deg, rgb(${channel.streamer.skinColor.map((c) => Math.round(c * 200)).join(",")}) 0%, var(--accent) 100%)`,
                    }}
                  >
                    {channel.streamer.name[0]}
                  </div>
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
          ))}
        </div>
      </div>
    </div>
  );
}
