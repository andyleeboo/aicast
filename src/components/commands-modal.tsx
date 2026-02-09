"use client";

import { useEffect } from "react";

const GAMES = [
  {
    name: "Hangman",
    description: "Bob picks a secret word — guess letters or the whole word before you run out of tries.",
    commands: ["/hangman", "/guess <letter>", "/guess <word>"],
  },
  {
    name: "20 Questions",
    description: "Bob thinks of something — ask yes/no questions to figure it out in 20 tries.",
    commands: ["/20q", "/ask <question>", "/answer <guess>"],
  },
];

const GESTURE_COMMANDS = ["/nod", "/shake"];
const CONTROL_COMMANDS = ["/wink", "/blink", "/sleep", "/wake"];
const EMOTION_COMMANDS = [
  "/happy", "/sad", "/surprised", "/thinking", "/angry", "/confused",
  "/excited", "/love", "/laughing", "/crying", "/smug", "/scared",
];
const REACTION_COMMANDS = [
  "/cool", "/dead", "/uwu", "/sparkles", "/judging", "/mindblown",
  "/shrug", "/flirty", "/hyper", "/pouting", "/derp", "/shy", "/spin",
];

const COMING_SOON = [
  { name: "Trivia", description: "Bob asks questions, chat races to answer" },
  { name: "Word Chain", description: "Say a word starting with the last letter" },
  { name: "Story Builder", description: "Collaborative storytelling with Bob" },
  { name: "Would You Rather", description: "Bob poses dilemmas, chat votes" },
  { name: "Rock Paper Scissors", description: "Play against Bob" },
];

const SUPER_CHAT_TIERS = [
  { icon: "💎", label: "Blue", cost: 2, style: "text-donation-blue" },
  { icon: "🏆", label: "Gold", cost: 10, style: "text-donation-gold" },
  { icon: "🔥", label: "Red", cost: 50, style: "text-donation-red" },
];

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-foreground/80">
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{children}</h3>;
}

export function CommandsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-surface shadow-xl ring-1 ring-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-bold">Commands &amp; Games</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-white/10 hover:text-foreground"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Games */}
          <section>
            <SectionTitle>Games</SectionTitle>
            <div className="space-y-3">
              {GAMES.map((game) => (
                <div key={game.name}>
                  <p className="text-sm font-semibold text-foreground">{game.name}</p>
                  <p className="mb-1.5 text-xs text-muted">{game.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {game.commands.map((cmd) => (
                      <Pill key={cmd}>{cmd}</Pill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Utility */}
          <section>
            <SectionTitle>Utility</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              <Pill>/endgame</Pill>
            </div>
          </section>

          {/* Super Chat */}
          <section>
            <SectionTitle>Super Chat</SectionTitle>
            <p className="mb-2 text-xs text-muted">
              Highlight your message with coins. Click the <span className="font-semibold text-donation-gold">$</span> button to pick a tier.
            </p>
            <div className="flex gap-3">
              {SUPER_CHAT_TIERS.map((tier) => (
                <span key={tier.label} className={`text-xs font-medium ${tier.style}`}>
                  {tier.icon} {tier.label} — {tier.cost} coins
                </span>
              ))}
            </div>
          </section>

          {/* Emotes & Gestures */}
          <section>
            <SectionTitle>Emotes &amp; Gestures</SectionTitle>
            <div className="space-y-2.5">
              <div>
                <p className="mb-1 text-xs font-medium text-foreground/70">Gestures</p>
                <div className="flex flex-wrap gap-1.5">
                  {GESTURE_COMMANDS.map((cmd) => <Pill key={cmd}>{cmd}</Pill>)}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-foreground/70">Controls</p>
                <div className="flex flex-wrap gap-1.5">
                  {CONTROL_COMMANDS.map((cmd) => <Pill key={cmd}>{cmd}</Pill>)}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-foreground/70">Emotions</p>
                <div className="flex flex-wrap gap-1.5">
                  {EMOTION_COMMANDS.map((cmd) => <Pill key={cmd}>{cmd}</Pill>)}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-foreground/70">Reactions</p>
                <div className="flex flex-wrap gap-1.5">
                  {REACTION_COMMANDS.map((cmd) => <Pill key={cmd}>{cmd}</Pill>)}
                </div>
              </div>
            </div>
          </section>

          {/* Coming Soon */}
          <section>
            <SectionTitle>Coming Soon</SectionTitle>
            <div className="space-y-1.5">
              {COMING_SOON.map((item) => (
                <div key={item.name} className="text-xs">
                  <span className="font-medium text-foreground/70">{item.name}</span>
                  <span className="text-muted"> — {item.description}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
