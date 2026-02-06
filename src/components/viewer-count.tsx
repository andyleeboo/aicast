"use client";

import { useViewerCount } from "@/hooks/use-viewer-count";

export function ViewerCount({
  channelId,
  username,
}: {
  channelId: string;
  username?: string;
}) {
  const count = useViewerCount(channelId, username);
  return <>{count.toLocaleString()} viewers</>;
}
