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
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:flex-row">
      {/* Video / stream placeholder */}
      <div className="flex flex-1 flex-col">
        <div className="relative flex flex-1 items-center justify-center bg-background">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-background to-background" />
          <div className="relative flex flex-col items-center gap-4 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent/20 text-4xl font-bold text-accent">
              {channel.streamer.name[0]}
            </div>
            <h1 className="text-2xl font-bold">{channel.name}</h1>
            <p className="text-muted">{channel.description}</p>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-live" />
                <span className="font-semibold text-live">LIVE</span>
              </span>
              <span className="text-muted">
                {channel.viewerCount.toLocaleString()} viewers
              </span>
              <span className="rounded-full bg-surface px-3 py-0.5 text-xs text-muted">
                {channel.category}
              </span>
            </div>
          </div>
        </div>

        {/* Stream info bar */}
        <div className="flex items-center gap-3 border-t border-border bg-surface px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
            {channel.streamer.name[0]}
          </div>
          <div>
            <p className="text-sm font-semibold">{channel.streamer.name}</p>
            <p className="text-xs text-muted">{channel.category}</p>
          </div>
        </div>
      </div>

      {/* Chat panel */}
      <div className="h-80 w-full border-t border-border lg:h-auto lg:w-96 lg:border-l lg:border-t-0">
        <ChatPanel
          streamerId={channel.id}
          streamerName={channel.streamer.name}
        />
      </div>
    </div>
  );
}
