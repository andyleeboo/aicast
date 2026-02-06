"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/lib/types";

export function ChatPanel({
  streamerId,
  streamerName,
}: {
  streamerId: string;
  streamerName: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

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

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Stream Chat</h2>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted">
            Say something to {streamerName}!
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="text-sm">
            <span
              className={`font-semibold ${
                msg.role === "user" ? "text-green-400" : "text-accent"
              }`}
            >
              {msg.role === "user" ? "You" : streamerName}
            </span>
            <span className="text-muted">: </span>
            <span className="text-foreground">{msg.content}</span>
          </div>
        ))}
        {loading && (
          <div className="text-sm">
            <span className="font-semibold text-accent">{streamerName}</span>
            <span className="text-muted">: </span>
            <span className="inline-flex gap-1 text-muted">
              <span className="animate-pulse">.</span>
              <span className="animate-pulse [animation-delay:0.2s]">.</span>
              <span className="animate-pulse [animation-delay:0.4s]">.</span>
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Send a message..."
            className="flex-1 rounded-lg bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none ring-1 ring-border focus:ring-accent"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            Chat
          </button>
        </div>
      </div>
    </div>
  );
}
