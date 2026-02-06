import Link from "next/link";
import { primaryChannel } from "@/lib/mock-data";
import { ViewerCount } from "@/components/viewer-count";

export default function Home() {
  const { streamer } = primaryChannel;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
          <span className="text-xl font-bold">AICast</span>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="flex max-w-2xl flex-col items-center text-center">
          {/* Live badge */}
          <div className="mb-8 flex items-center gap-2 rounded-full bg-live/10 px-4 py-1.5 ring-1 ring-live/30">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-live" />
            </span>
            <span className="text-sm font-medium text-live">
              Live now — <ViewerCount channelId="late-night-ai" /> watching
            </span>
          </div>

          {/* Avatar */}
          <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent/40 text-5xl font-bold text-white shadow-lg shadow-accent/20">
            N
          </div>

          {/* Title */}
          <h1 className="mb-3 text-5xl font-bold tracking-tight sm:text-6xl">
            Late Night AI
          </h1>
          <p className="mb-2 text-lg text-muted">
            Hosted by <span className="font-semibold text-accent">{streamer.name}</span>
          </p>
          <p className="mb-10 max-w-lg text-base leading-relaxed text-muted">
            {primaryChannel.description}
          </p>

          {/* CTA */}
          <Link
            href={`/live/${primaryChannel.id}`}
            className="group flex items-center gap-3 rounded-xl bg-accent px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/25"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Join the Stream
          </Link>

          {/* Subtitle */}
          <p className="mt-4 text-sm text-muted/60">
            Free to watch. Type in chat. No account needed.
          </p>
        </div>
      </main>

      {/* Footer hint */}
      <footer className="pb-6 text-center text-xs text-muted/40">
        Powered by AI. Built with AICast.
      </footer>
    </div>
  );
}
