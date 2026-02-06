import Link from "next/link";
import { notFound } from "next/navigation";
import { getChannel } from "@/lib/mock-data";
import { ChatPanel } from "@/components/chat-panel";

export default async function LivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const channel = getChannel(id);

  if (!channel) notFound();

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
        <Link href="/" className="flex items-center gap-2">
          <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
          <span className="text-lg font-bold">AICast</span>
        </Link>

        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
            </span>
            <span className="font-medium text-live">LIVE</span>
          </span>
          <span className="text-muted">
            {channel.viewerCount.toLocaleString()} viewers
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Stream area */}
        <div className="flex flex-1 flex-col">
          {/* Video placeholder */}
          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
            {/* Animated background */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/5" />
            <div className="absolute inset-0 opacity-30">
              <div className="absolute left-1/4 top-1/4 h-64 w-64 animate-pulse rounded-full bg-accent/10 blur-3xl" />
              <div className="absolute bottom-1/4 right-1/4 h-48 w-48 animate-pulse rounded-full bg-accent/5 blur-3xl [animation-delay:1s]" />
            </div>

            {/* Streamer presence */}
            <div className="relative flex flex-col items-center gap-6">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent/40 text-6xl font-bold text-white shadow-2xl shadow-accent/30 ring-4 ring-accent/20">
                N
              </div>
              <div className="text-center">
                <h1 className="text-3xl font-bold">{channel.name}</h1>
                <p className="mt-1 text-muted">{channel.streamer.name} is live</p>
              </div>
            </div>
          </div>

          {/* Stream info bar */}
          <div className="flex items-center gap-4 border-t border-border bg-surface px-5 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent/40 text-sm font-bold text-white">
              N
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{channel.streamer.name}</p>
              <p className="truncate text-xs text-muted">{channel.description}</p>
            </div>
            <span className="shrink-0 rounded-full bg-surface-hover px-3 py-1 text-xs text-muted">
              {channel.category}
            </span>
          </div>
        </div>

        {/* Chat */}
        <div className="h-[45vh] w-full border-t border-border lg:h-auto lg:w-[380px] lg:border-l lg:border-t-0">
          <ChatPanel
            streamerId={channel.id}
            streamerName={channel.streamer.name}
          />
        </div>
      </div>
    </div>
  );
}
