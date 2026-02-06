"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage, GestureReaction, EmoteCommand } from "@/lib/types";

const SLASH_COMMANDS: Record<string, { emote: EmoteCommand; msg: string }> = {
  "/wink":  { emote: "wink",  msg: "{name} winks at chat" },
  "/blink": { emote: "blink", msg: "{name} blinks" },
  "/sleep": { emote: "sleep", msg: "{name} falls asleep..." },
  "/wake":  { emote: "wake",  msg: "{name} wakes up!" },
};

export function ChatPanel({
  streamerId,
  streamerName,
  onAIResponse,
  onEmote,
}: {
  streamerId: string;
  streamerName: string;
  onAIResponse?: (gesture: GestureReaction) => void;
  onEmote?: (emote: EmoteCommand) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Welcome to the stream, chat! I'm ${streamerName}. Ask me anything, roast me, or just hang out. Let's go.`,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    // Check for slash commands
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
      onEmote?.(slashCmd.emote);
      return;
    }

    // Regular message — wake if sleeping
    onEmote?.("wake");

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          streamerId,
          history: messages,
        }),
      });

      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMsg]);
      if (data.gesture && onAIResponse) {
        onAIResponse(data.gesture as GestureReaction);
      }
      if (data.emote) {
        onEmote?.(data.emote as EmoteCommand);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Oops, something went wrong. Try again!",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
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
        <h2 className="text-sm font-semibold">Stream Chat</h2>
        <span className="text-xs text-muted">
          {messages.length} messages
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className="group text-sm leading-relaxed">
              <span className="mr-1 text-[10px] text-muted/50 opacity-0 transition-opacity group-hover:opacity-100">
                {formatTime(msg.timestamp)}
              </span>
              {msg.role === "system" ? (
                <span className="italic text-yellow-400">{msg.content}</span>
              ) : (
                <>
                  <span
                    className={`font-semibold ${
                      msg.role === "user" ? "text-green-400" : "text-accent"
                    }`}
                  >
                    {msg.role === "user" ? "You" : streamerName}
                  </span>
                  <span className="text-muted">: </span>
                  <span className="text-foreground/90">{msg.content}</span>
                </>
              )}
            </div>
          ))}
          {loading && (
            <div className="text-sm">
              <span className="font-semibold text-accent">{streamerName}</span>
              <span className="text-muted"> is typing</span>
              <span className="inline-flex ml-0.5">
                <span className="animate-bounce text-muted [animation-delay:0ms]">.</span>
                <span className="animate-bounce text-muted [animation-delay:150ms]">.</span>
                <span className="animate-bounce text-muted [animation-delay:300ms]">.</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
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
            placeholder="Send a message..."
            className="flex-1 rounded-lg bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 outline-none ring-1 ring-border transition-shadow focus:ring-accent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Chat
          </button>
        </form>
      </div>
    </div>
  );
}
