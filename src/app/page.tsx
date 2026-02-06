"use client";

import { useState } from "react";
import { ChannelGrid } from "@/components/channel-grid";
import { channels, categories } from "@/lib/mock-data";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered =
    activeCategory === "All"
      ? channels
      : channels.filter((c) => c.category === activeCategory);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">
        Live Channels
      </h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === cat
                ? "bg-accent text-white"
                : "bg-surface text-muted hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <ChannelGrid channels={filtered} />
    </div>
  );
}
