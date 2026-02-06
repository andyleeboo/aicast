"use client";

import { useViewerCount } from "@/hooks/use-viewer-count";

export function ViewerCount({ channelId }: { channelId: string }) {
  const count = useViewerCount(channelId);
  return <>{count.toLocaleString()} viewers</>;
}
