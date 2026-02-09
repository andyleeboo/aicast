"use client";

import type { DonationTier } from "@/lib/types";

interface Tier {
  id: DonationTier;
  cost: number;
  label: string;
  icon: string;
  colorClass: string;
  description: string;
}

const TIERS: Tier[] = [
  {
    id: "blue",
    cost: 2,
    label: "Blue",
    icon: "\u{1F48E}",
    colorClass: "border-donation-blue bg-donation-blue/10 hover:bg-donation-blue/20",
    description: "Highlighted message",
  },
  {
    id: "gold",
    cost: 10,
    label: "Gold",
    icon: "\u{1F3C6}",
    colorClass: "border-donation-gold bg-donation-gold/10 hover:bg-donation-gold/20",
    description: "Pinned 30s + Bob reads aloud",
  },
  {
    id: "red",
    cost: 50,
    label: "Red",
    icon: "\u{1F525}",
    colorClass: "border-donation-red bg-donation-red/10 hover:bg-donation-red/20",
    description: "Pinned 60s + DRAMATIC reaction",
  },
];

export function SuperChatSelector({
  coins,
  onSelect,
  onClose,
}: {
  coins: number;
  onSelect: (tier: DonationTier) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-full right-0 z-20 mb-2 w-64 rounded-2xl bg-surface p-4 shadow-xl ring-1 ring-border">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">Super Chat</span>
        <button
          onClick={onClose}
          className="text-xs text-muted hover:text-foreground"
        >
          &times;
        </button>
      </div>

      <div className="space-y-2">
        {TIERS.map((tier) => {
          const canAfford = coins >= tier.cost;
          return (
            <button
              key={tier.id}
              disabled={!canAfford}
              onClick={() => onSelect(tier.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tier.colorClass}`}
            >
              <span className="text-lg">{tier.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  ${tier.cost} {tier.label}
                </div>
                <div className="text-xs text-muted">{tier.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 text-center text-xs text-muted">
        Balance: {coins} coins
      </div>
    </div>
  );
}
