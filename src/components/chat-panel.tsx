"use client";

import { useState, useRef, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import { validateMessage } from "@/lib/moderation";
import { dbRowToChatMessage } from "@/lib/types";
import { trackEvent } from "@/lib/firebase";
import type {
  ChatMessage,
  MessageRow,
  GestureReaction,
  EmoteCommand,
} from "@/lib/types";

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
};

export function ChatPanel({
  channelId,
  streamerName,
  username,
  onEmote,
  onGesture,
  onUserInteraction,
}: {
  channelId: string;
  streamerName: string;
  username: string;
  onEmote?: (emote: EmoteCommand) => void;
  onGesture?: (gesture: GestureReaction) => void;
  onUserInteraction?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Load initial messages, subscribe to Realtime, and poll as fallback
  useEffect(() => {
    let mounted = true;
    const sb = getSupabase();
    if (!sb) return;
    const supabase = sb;

    // Merge new rows into state, deduplicating by ID and optimistic matches
    function mergeMessages(incoming: MessageRow[]) {
      const newMsgs = incoming
        .filter((r) => r.role === "user")
        .map(dbRowToChatMessage);
      if (newMsgs.length === 0) return;

      setMessages((prev) => {
        let updated = prev;
        for (const msg of newMsgs) {
          if (updated.some((m) => m.id === msg.id)) continue;
          // Skip optimistic duplicates
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

    // Load last 50 messages from the past 3 hours
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

    // Realtime subscription (may not work with publishable keys)
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
          console.log("[realtime] INSERT received:", payload.new);
          mergeMessages([payload.new as MessageRow]);
        },
      )
      .subscribe((status, err) => {
        console.log("[realtime] Subscription status:", status, err ?? "");
      });

    // Polling fallback — guarantees cross-device sync every 5s
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

  async function send() {
    const text = input.trim();
    if (!text) return;
    onUserInteraction?.();

    // Check for slash commands — bypass API entirely
    const slashCmd = SLASH_COMMANDS[text.toLowerCase()];
    if (slashCmd) {
      const systemMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "system",
        content: slashCmd.msg.replace("{name}", streamerName),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, systemMsg]);
      setInput("");
      trackEvent("slash_command_used", { command: text.toLowerCase() });
      if (slashCmd.emote) onEmote?.(slashCmd.emote);
      if (slashCmd.gesture) onGesture?.(slashCmd.gesture);
      return;
    }

    // Client-side moderation
    const check = validateMessage(text);
    if (!check.valid) {
      setError(check.error ?? "Message rejected");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setError(null);
    setInput("");

    // Add user message to local state immediately (optimistic)
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      username,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    trackEvent("chat_message_sent");

    // Fire-and-forget to server queue
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, content: text, channelId }),
    }).catch(() => {
      // Silently fail — user message is already shown optimistically
      // and Supabase Realtime will sync if available
    });
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">The Lobby</h2>
        <span className="text-xs text-muted">
          {messages.length} messages
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-3 sm:px-4">
        <div className="space-y-2">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === "system" ? (
                <span className="text-sm italic text-yellow-400">{msg.content}</span>
              ) : (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-semibold text-green-400">
                      {msg.username || "Anon"}
                    </span>
                    <span className="text-[10px] text-muted/50">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{msg.content}</p>
                </>
              )}
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-center text-xs text-muted/60 py-8">
              Chat's empty — be the first to say something
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        {error && (
          <p className="mb-2 text-xs text-red-400">{error}</p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Say something..."
            className="flex-1 rounded-lg bg-background px-3 py-2 text-base text-foreground placeholder:text-muted/60 outline-none ring-1 ring-border transition-shadow focus:ring-accent"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Chat
          </button>
        </form>
      </div>
    </div>
  );
}
