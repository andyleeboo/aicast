"use client";

import Link from "next/link";
import { channels } from "@/lib/mock-data";

export function Sidebar() {
  const liveChannels = channels.filter((c) => c.isLive).slice(0, 6);

  return (
    <aside className="fixed left-0 top-14 z-40 hidden h-[calc(100vh-3.5rem)] w-60 flex-col border-r border-border bg-surface lg:flex">
      <div className="p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Recommended Channels
        </h2>
        <ul className="space-y-1">
          {liveChannels.map((channel) => (
            <li key={channel.id}>
              <Link
                href={`/live/${channel.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-hover"
              >
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
                  {channel.streamer.name[0]}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-live" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {channel.streamer.name}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {channel.category}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-live" />
                  {channel.viewerCount >= 1000
                    ? `${(channel.viewerCount / 1000).toFixed(1)}K`
                    : channel.viewerCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
