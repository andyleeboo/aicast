"use client";

import { useEffect, useState } from "react";
import type { DonationTier } from "@/lib/types";

const TIER_CONFIG: Record<DonationTier, { count: number; color: string }> = {
  blue: { count: 20, color: "var(--donation-blue)" },
  gold: { count: 35, color: "var(--donation-gold)" },
  red:  { count: 50, color: "var(--donation-red)" },
};

interface Particle {
  id: number;
  x: number;
  y: number;
  driftX: number;
  size: number;
  delay: number;
  duration: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -(80 + Math.random() * 120),
    driftX: (Math.random() - 0.5) * 120,
    size: 4 + Math.random() * 4,
    delay: Math.random() * 300,
    duration: 600 + Math.random() * 600,
  }));
}

export function CoinConfetti({
  tier,
  onComplete,
}: {
  tier: DonationTier;
  onComplete: () => void;
}) {
  const [particles] = useState(() => generateParticles(TIER_CONFIG[tier].count));
  const color = TIER_CONFIG[tier].color;

  useEffect(() => {
    const maxTime = Math.max(...particles.map((p) => p.delay + p.duration));
    const t = setTimeout(onComplete, maxTime + 50);
    return () => clearTimeout(t);
  }, [particles, onComplete]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            bottom: 0,
            width: p.size,
            height: p.size,
            backgroundColor: color,
            "--confetti-y": `${p.y}px`,
            "--confetti-x": `${p.driftX}px`,
            animation: `confetti-pop ${p.duration}ms ease-out ${p.delay}ms forwards`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
