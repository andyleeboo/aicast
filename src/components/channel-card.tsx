import Link from "next/link";
import { Channel } from "@/lib/types";

export function ChannelCard({ channel }: { channel: Channel }) {
  return (
    <Link href={`/live/${channel.id}`} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-surface transition-transform duration-200 group-hover:scale-[1.02] group-hover:shadow-lg group-hover:shadow-accent/10">
        {/* Gradient placeholder thumbnail */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent/30 via-surface to-background" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-bold text-accent/40">
            {channel.streamer.name[0]}
          </span>
        </div>

        {/* Live badge + viewer count */}
        <div className="absolute left-2 top-2 flex items-center gap-2">
          {channel.isLive && (
            <span className="rounded bg-live px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Live
            </span>
          )}
        </div>
        <div className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
          {channel.viewerCount.toLocaleString()} viewers
        </div>
      </div>

      <div className="mt-2 flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
          {channel.streamer.name[0]}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {channel.name}
          </p>
          <p className="truncate text-xs text-muted">
            {channel.streamer.name}
          </p>
          <p className="truncate text-xs text-muted">{channel.category}</p>
        </div>
      </div>
    </Link>
  );
}
