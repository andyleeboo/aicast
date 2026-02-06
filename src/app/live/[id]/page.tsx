import Link from "next/link";
import { notFound } from "next/navigation";
import { getChannelFromDB } from "@/lib/mock-data";
import { BroadcastContent } from "@/components/broadcast-content";
import { ViewerCount } from "@/components/viewer-count";

export default async function LivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const channel = await getChannelFromDB(id);

  if (!channel) notFound();

  return (
    <div className="flex h-dvh flex-col">
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
            <ViewerCount channelId={id} />
          </span>
        </div>
      </header>

      {/* Main content */}
      <BroadcastContent channel={channel} />
    </div>
  );
}
