"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { validateMessage } from "@/lib/moderation";
import { dbRowToChatMessage } from "@/lib/types";
import { trackEvent } from "@/lib/firebase";
import { SuperChatSelector } from "./superchat-selector";
import { CoinConfetti } from "./confetti";
import { CommandsModal } from "./commands-modal";
import type {
  ChatMessage,
  MessageRow,
  GestureReaction,
  EmoteCommand,
  DonationTier,
} from "@/lib/types";
import type { GameClientState } from "@/lib/games/game-types";

const SLASH_COMMANDS: Record<string, { emote?: EmoteCommand; gesture?: GestureReaction; msg: string }> = {
  // Gestures
  "/nod":        { gesture: "yes",         msg: "{name} nods" },
  "/shake":      { gesture: "no",          msg: "{name} shakes head" },
  // Core controls
  "/wink":       { emote: "wink",          msg: "{name} winks at chat" },
  "/blink":      { emote: "blink",         msg: "{name} blinks" },
  "/sleep":      { emote: "sleep",         msg: "{name} falls asleep..." },
  "/wake":       { emote: "wake",          msg: "{name} wakes up!" },
  // Emotions
  "/happy":      { emote: "happy",         msg: "{name} beams with joy!" },
  "/sad":        { emote: "sad",           msg: "{name} looks sad..." },
  "/surprised":  { emote: "surprised",     msg: "{name} is shocked!" },
  "/thinking":   { emote: "thinking",      msg: "{name} ponders..." },
  "/angry":      { emote: "angry",         msg: "{name} is angry!" },
  "/confused":   { emote: "confused",      msg: "{name} is confused..." },
  "/excited":    { emote: "excited",       msg: "{name} is hyped!" },
  "/love":       { emote: "love",          msg: "{name} is in love!" },
  "/laughing":   { emote: "laughing",      msg: "{name} is cracking up!" },
  "/crying":     { emote: "crying",        msg: "{name} is crying!" },
  "/smug":       { emote: "smug",          msg: "{name} looks smug" },
  "/scared":     { emote: "scared",        msg: "{name} is terrified!" },
  "/cool":       { emote: "cool",          msg: "{name} is too cool" },
  "/dead":       { emote: "dead",          msg: "{name} is deceased" },
  "/uwu":        { emote: "uwu",          msg: "{name} goes uwu" },
  "/sparkles":   { emote: "sparkles",      msg: "{name} sparkles!" },
  "/judging":    { emote: "judging",       msg: "{name} judges you" },
  "/mindblown":  { emote: "mindblown",     msg: "{name}'s mind is blown" },
  "/shrug":      { emote: "shrug",         msg: "{name} shrugs" },
  "/flirty":     { emote: "flirty",        msg: "{name} flirts" },
  "/hyper":      { emote: "hyper",         msg: "{name} is HYPER!" },
  "/pouting":    { emote: "pouting",       msg: "{name} pouts" },
  "/derp":       { emote: "derp",          msg: "{name} derps out" },
  "/shy":        { emote: "shy",           msg: "{name} is shy..." },
  "/spin":       { emote: "spin",          msg: "{name} spins around!" },
};

const TIER_COSTS: Record<DonationTier, number> = { blue: 2, gold: 10, red: 50 };
const TIER_ICONS: Record<DonationTier, string> = { blue: "\u{1F48E}", gold: "\u{1F3C6}", red: "\u{1F525}" };
const TIER_BADGE_STYLES: Record<DonationTier, string> = {
  blue: "bg-donation-blue/20 text-donation-blue",
  gold: "bg-donation-gold/20 text-donation-gold",
  red: "bg-donation-red/20 text-donation-red",
};
const COINS_KEY = "aicast_coins";
const DEFAULT_COINS = 100;

function getInitialCoins(): number {
  if (typeof window === "undefined") return DEFAULT_COINS;
  const stored = localStorage.getItem(COINS_KEY);
  return stored ? Number(stored) : DEFAULT_COINS;
}

function useCoinBalance() {
  const [coins, setCoins] = useState(getInitialCoins);
  const spend = useCallback((amount: number) => {
    setCoins((prev) => {
      const next = prev - amount;
      localStorage.setItem(COINS_KEY, String(next));
      return next;
    });
  }, []);
  return { coins, spend };
}

interface PinnedDonation {
  id: string;
  username: string;
  content: string;
  tier: DonationTier;
  amount: number;
  expiresAt: number;
}

function usePinnedDonations() {
  const [pins, setPins] = useState<PinnedDonation[]>([]);
  const addPin = useCallback((donation: Omit<PinnedDonation, "expiresAt">) => {
    const duration = donation.tier === "red" ? 60_000 : 30_000;
    setPins((prev) => {
      if (prev.some((p) => p.id === donation.id)) return prev;
      return [...prev, { ...donation, expiresAt: Date.now() + duration }];
    });
  }, []);
  useEffect(() => {
    const t = setInterval(() => setPins((p) => p.filter((d) => d.expiresAt > Date.now())), 1000);
    return () => clearInterval(t);
  }, []);
  return { pins, addPin };
}

export interface DonationEvent {
  id: string;
  donationTier: DonationTier;
  donationAmount: number;
  donationUsername: string;
  donationContent: string;
}

const DONATION_STYLES: Record<DonationTier, string> = {
  blue: "border-l-2 border-donation-blue bg-donation-blue/10 pl-2 rounded-r",
  gold: "border-l-2 border-donation-gold bg-donation-gold/10 pl-2 rounded-r",
  red: "border-l-2 border-donation-red bg-donation-red/10 pl-2 rounded-r animate-[donation-glow_2s_ease-in-out_infinite]",
};

const PIN_STYLES: Record<DonationTier, string> = {
  blue: "",
  gold: "border-donation-gold bg-donation-gold/15 text-donation-gold",
  red: "border-donation-red bg-donation-red/15 text-donation-red",
};

export function ChatPanel({
  channelId,
  streamerName,
  username,
  onEmote,
  onGesture,
  onUserInteraction,
  onGameState,
  onMessageSent,
  donations,
}: {
  channelId: string;
  streamerName: string;
  username: string;
  onEmote?: (emote: EmoteCommand) => void;
  onGesture?: (gesture: GestureReaction) => void;
  onUserInteraction?: () => void;
  onGameState?: (state: GameClientState) => void;
  onMessageSent?: () => void;
  donations?: DonationEvent[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [selectedTier, setSelectedTier] = useState<DonationTier | null>(null);
  const [confettiMsgs, setConfettiMsgs] = useState<Set<string>>(new Set());
  const [showHelp, setShowHelp] = useState(false);

  const { coins, spend } = useCoinBalance();
  const { pins, addPin } = usePinnedDonations();
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const processedDonations = useRef(0);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Handle SSE donation events from other viewers
  const donationLen = donations?.length ?? 0;
  useEffect(() => {
    if (!donations || donationLen <= processedDonations.current) return;
    const newDonations = donations.slice(processedDonations.current);
    processedDonations.current = donationLen;

    for (const d of newDonations) {
      // Add to messages (skip if already present from optimistic add)
      setMessages((prev) => {
        if (prev.some((m) => m.id === d.id)) return prev;
        return [
          ...prev,
          {
            id: d.id,
            role: "user" as const,
            content: d.donationContent,
            username: d.donationUsername,
            timestamp: Date.now(),
            donationTier: d.donationTier,
            donationAmount: d.donationAmount,
          },
        ];
      });

      // Pin Gold/Red
      if (d.donationTier === "gold" || d.donationTier === "red") {
        addPin({
          id: d.id,
          username: d.donationUsername,
          content: d.donationContent,
          tier: d.donationTier,
          amount: d.donationAmount,
        });
      }

      // Trigger confetti
      setConfettiMsgs((prev) => new Set(prev).add(d.id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donationLen]);

  // Close selector when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setShowSelector(false);
      }
    }
    if (showSelector) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showSelector]);

  // Load initial messages, subscribe to Realtime, and poll as fallback
  useEffect(() => {
    let mounted = true;
    const sb = getSupabase();
    if (!sb) return;
    const supabase = sb;

    function mergeMessages(incoming: MessageRow[]) {
      const newMsgs = incoming
        .filter((r) => r.role === "user")
        .map(dbRowToChatMessage);
      if (newMsgs.length === 0) return;

      setMessages((prev) => {
        let updated = prev;
        for (const msg of newMsgs) {
          if (updated.some((m) => m.id === msg.id)) continue;
          if (
            updated.some(
              (m) =>
                m.role === msg.role &&
                m.content === msg.content &&
                m.username === msg.username &&
                Math.abs(m.timestamp - msg.timestamp) < 30_000,
            )
          )
            continue;
          updated = [...updated, msg];
        }
        return updated;
      });
    }

    async function loadMessages() {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channelId)
        .eq("role", "user")
        .gte("created_at", threeHoursAgo)
        .order("created_at", { ascending: false })
        .limit(50);

      if (mounted && data) {
        setMessages(data.reverse().map(dbRowToChatMessage));
      }
    }

    loadMessages();

    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          mergeMessages([payload.new as MessageRow]);
        },
      )
      .subscribe();

    const poll = setInterval(async () => {
      const fiveSecondsAgo = new Date(Date.now() - 6_000).toISOString();
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channelId)
        .eq("role", "user")
        .gte("created_at", fiveSecondsAgo)
        .order("created_at", { ascending: true })
        .limit(20);

      if (mounted && data && data.length > 0) {
        mergeMessages(data);
      }
    }, 5_000);

    return () => {
      mounted = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  function addSystemMessage(content: string): void {
    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(),
      role: "system" as const,
      content,
      timestamp: Date.now(),
    }]);
  }

  function sendGameCommand(
    command: string,
    body: Record<string, string>,
    formatResponse: (data: Record<string, unknown>) => string,
  ): void {
    setInput("");
    trackEvent("slash_command_used", { command });
    fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((data) => {
        addSystemMessage(data.error ? data.error : formatResponse(data));
        if (data.state) onGameState?.(data.state as GameClientState);
      })
      .catch(() => {});
  }

  async function send() {
    const text = input.trim();
    if (!text) return;
    onUserInteraction?.();

    // Game commands
    const lower = text.toLowerCase();
    if (lower === "/hangman") {
      sendGameCommand("/hangman", { action: "start", game: "hangman" }, () =>
        `${username} started a game of Hangman! Type /guess <letter> to play`,
      );
      return;
    }

    if (lower.startsWith("/guess ")) {
      const value = text.slice(7).trim();
      if (!value) return;
      const label = value.length === 1 ? value.toUpperCase() : `"${value}"`;
      sendGameCommand("/guess", { action: "guess", value }, (data) => {
        trackEvent("game_guess", { game: "hangman", value, correct: !!data.correct });
        return data.correct
          ? `${username} guessed ${label} — correct!`
          : `${username} guessed ${label} — wrong!`;
      });
      return;
    }

    if (lower === "/20q") {
      sendGameCommand("/20q", { action: "start", game: "twentyq" }, () =>
        `${username} started 20 Questions! Type /ask <question> to play`,
      );
      return;
    }

    if (lower.startsWith("/ask ")) {
      const value = text.slice(5).trim();
      if (!value) return;
      trackEvent("game_question", { game: "twentyq", type: "ask" });
      sendGameCommand("/ask", { action: "ask", value }, () =>
        `${username} asked: "${value}" — waiting for Bob...`,
      );
      return;
    }

    if (lower.startsWith("/answer ")) {
      const value = text.slice(8).trim();
      if (!value) return;
      trackEvent("game_question", { game: "twentyq", type: "answer" });
      sendGameCommand("/answer", { action: "answer", value }, () =>
        `${username} guesses: "${value}" — Bob is thinking...`,
      );
      return;
    }

    if (lower === "/endgame") {
      sendGameCommand("/endgame", { action: "stop" }, () =>
        `${username} ended the game`,
      );
      return;
    }

    // Slash commands — bypass API
    const slashCmd = SLASH_COMMANDS[lower];
    if (slashCmd) {
      addSystemMessage(slashCmd.msg.replace("{name}", streamerName));
      setInput("");
      trackEvent("slash_command_used", {
        command: lower,
        type: slashCmd.emote ? "emote" : "gesture",
        action: slashCmd.emote ?? slashCmd.gesture ?? lower,
      });
      if (slashCmd.emote) onEmote?.(slashCmd.emote);
      if (slashCmd.gesture) onGesture?.(slashCmd.gesture);
      return;
    }

    // Client-side moderation
    const check = validateMessage(text);
    if (!check.valid) {
      setError(check.error ?? "Message rejected");
      trackEvent("message_blocked", { reason: check.error ?? "unknown" });
      setTimeout(() => setError(null), 3000);
      return;
    }

    setError(null);
    setInput("");

    // Super Chat path
    if (selectedTier) {
      const tier = selectedTier;
      const amount = TIER_COSTS[tier];
      setSelectedTier(null);
      spend(amount);

      const msgId = crypto.randomUUID();
      const userMsg: ChatMessage = {
        id: msgId,
        role: "user",
        content: text,
        username,
        timestamp: Date.now(),
        donationTier: tier,
        donationAmount: amount,
      };
      setMessages((prev) => [...prev, userMsg]);
      setConfettiMsgs((prev) => new Set(prev).add(msgId));
      trackEvent("superchat_sent", { tier, amount });

      // Pin Gold/Red
      if (tier === "gold" || tier === "red") {
        addPin({ id: msgId, username, content: text, tier, amount });
      }

      fetch("/api/donation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, content: text, tier, channelId, msgId }),
      }).catch(() => {});
      return;
    }

    // Normal message path
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      username,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    trackEvent("chat_message_sent");
    onMessageSent?.();

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, content: text, channelId }),
    }).catch(() => {});
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function handleConfettiComplete(msgId: string) {
    setConfettiMsgs((prev) => {
      const next = new Set(prev);
      next.delete(msgId);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Header */}
      <div className="hidden items-center justify-between border-b border-border px-4 py-3 lg:flex">
        <h2 className="text-sm font-semibold">The Lobby</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setShowHelp(true); trackEvent("help_modal_opened"); }}
            className="rounded-lg px-2 py-1 text-xs font-bold text-muted transition-colors hover:bg-white/10 hover:text-foreground"
            title="Commands & Games"
          >
            ?
          </button>
          <span className="text-xs text-muted">
            {coins} coins
          </span>
        </div>
      </div>

      {/* Pinned donations */}
      {pins.length > 0 && (
        <div className="space-y-1 border-b border-border px-2 py-2">
          {pins.map((pin) => (
            <div
              key={pin.id}
              className={`rounded-lg border px-3 py-1.5 text-xs ${PIN_STYLES[pin.tier]}`}
            >
              <span className="font-semibold">{TIER_ICONS[pin.tier]} ${pin.amount} {pin.username}:</span>{" "}
              {pin.content}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-3 sm:px-4">
        <div className="space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className="relative">
              {msg.role === "system" ? (
                <span className="text-sm italic text-yellow-400">{msg.content}</span>
              ) : (
                <div className={msg.donationTier ? `py-1.5 ${DONATION_STYLES[msg.donationTier]}` : ""}>
                  <div className="flex items-baseline gap-1.5">
                    {msg.donationTier && (
                      <span className="text-xs">
                        {TIER_ICONS[msg.donationTier]} ${msg.donationAmount}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-green-400">
                      {msg.username || "Anon"}
                    </span>
                    <span className="text-[10px] text-muted/50">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{msg.content}</p>
                </div>
              )}
              {confettiMsgs.has(msg.id) && msg.donationTier && (
                <CoinConfetti
                  tier={msg.donationTier}
                  onComplete={() => handleConfettiComplete(msg.id)}
                />
              )}
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-center text-xs text-muted/60 py-8">
              Chat&apos;s empty — be the first to say something
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        {error && (
          <p className="mb-2 text-xs text-red-400">{error}</p>
        )}
        {selectedTier && (
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className={`rounded px-2 py-0.5 font-semibold ${TIER_BADGE_STYLES[selectedTier]}`}>
              {TIER_ICONS[selectedTier]} ${TIER_COSTS[selectedTier]} Super Chat
            </span>
            <button
              onClick={() => setSelectedTier(null)}
              className="text-muted hover:text-foreground"
            >
              &times; cancel
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2"
        >
          <button
            type="button"
            onClick={() => { setShowHelp(true); trackEvent("help_modal_opened"); }}
            className="rounded-lg bg-white/10 px-2.5 py-2 text-sm font-bold text-muted transition-colors hover:text-foreground lg:hidden"
            title="Commands & Games"
          >
            ?
          </button>
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 500))}
              maxLength={500}
              placeholder={selectedTier ? "Type your Super Chat message..." : "Say something..."}
              className="w-full rounded-lg bg-background px-3 py-2 pr-16 text-base text-foreground placeholder:text-muted/60 outline-none ring-1 ring-border transition-shadow focus:ring-accent"
            />
            {input.length > 0 && (
              <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums ${input.length >= 450 ? (input.length >= 500 ? "text-red-400" : "text-yellow-400") : "text-muted/40"}`}>
                {input.length}/500
              </span>
            )}
          </div>
          <div className="relative" ref={selectorRef}>
            <button
              type="button"
              onClick={() => setShowSelector((v) => !v)}
              className="rounded-lg bg-donation-gold/20 px-3 py-2 text-sm font-bold text-donation-gold transition-colors hover:bg-donation-gold/30"
              title="Super Chat"
            >
              $
            </button>
            {showSelector && (
              <SuperChatSelector
                coins={coins}
                onSelect={(tier) => {
                  setSelectedTier(tier);
                  setShowSelector(false);
                }}
                onClose={() => setShowSelector(false)}
              />
            )}
          </div>
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Chat
          </button>
        </form>
      </div>

      {showHelp && <CommandsModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
