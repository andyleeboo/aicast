import { Channel } from "@/lib/types";
import { ChannelCard } from "./channel-card";

export function ChannelGrid({ channels }: { channels: Channel[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {channels.map((channel) => (
        <ChannelCard key={channel.id} channel={channel} />
      ))}
    </div>
  );
}
