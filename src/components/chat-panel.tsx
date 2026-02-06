"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type {
  ChatMessage,
  GestureReaction,
  EmoteCommand,
  BatchedChatMessage,
  ChatResponse,
} from "@/lib/types";

const BATCH_WINDOW_MS = 3000;

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
  onSpeechBubble,
  onAudioData,
  onUserInteraction,
}: {
  streamerId: string;
  streamerName: string;
  onAIResponse?: (gesture: GestureReaction) => void;
  onEmote?: (emote: EmoteCommand) => void;
  onSpeechBubble?: (text: string | null) => void;
  onAudioData?: (data: string) => void;
  onUserInteraction?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [usernameConfirmed, setUsernameConfirmed] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const batchQueue = useRef<BatchedChatMessage[]>([]);
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationHistory = useRef<ChatMessage[]>([]);
  const messagesRef = useRef(messages);

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (batchTimer.current) clearTimeout(batchTimer.current);
    };
  }, []);

  const flushBatch = useCallback(async () => {
    const batch = batchQueue.current;
    batchQueue.current = [];
    batchTimer.current = null;

    if (batch.length === 0) return;

    // Wake the avatar when real messages come in
    onEmote?.("wake");

    // Build the batch text for conversation history
    const batchLines = batch.map((m) => `${m.username}: ${m.content}`);
    const batchText = `[CHAT BATCH - ${batch.length} message(s)]\n${batchLines.join("\n")}`;

    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch,
          streamerId,
          history: conversationHistory.current,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `API error ${res.status}`);
      }

      const data = (await res.json()) as ChatResponse;

      // Update conversation history with this batch turn
      conversationHistory.current = [
        ...conversationHistory.current,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: batchText,
          timestamp: Date.now(),
        },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.response,
          timestamp: Date.now(),
        },
      ];

      // Bob speaks on stream (speech bubble + TTS), not in chat
      onAIResponse?.(data.gesture);
      onSpeechBubble?.(data.response);
      if (data.audioData) {
        onAudioData?.(data.audioData);
      }
      if (data.emote) {
        onEmote?.(data.emote);
      }
    } catch {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "system",
        content: "Failed to reach the AI — try again in a sec.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      // If new messages queued during the API call, start a new timer
      if (batchQueue.current.length > 0) {
        batchTimer.current = setTimeout(flushBatch, BATCH_WINDOW_MS);
      }
    }
  }, [streamerId, onAIResponse, onEmote, onSpeechBubble, onAudioData]);

  function send() {
    const text = input.trim();
    if (!text) return;
    onUserInteraction?.();

    // Check for slash commands — bypass queue entirely
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

    // Regular message — add to display immediately
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now(),
      username,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Enqueue for batch
    const batchMsg: BatchedChatMessage = {
      id: userMsg.id,
      username,
      content: text,
      timestamp: Date.now(),
      priority: "normal",
    };
    batchQueue.current.push(batchMsg);

    // Start timer on first message in queue
    if (!batchTimer.current) {
      batchTimer.current = setTimeout(flushBatch, BATCH_WINDOW_MS);
    }
  }

  function confirmUsername() {
    const name = nameInput.trim();
    if (!name) return;
    onUserInteraction?.();
    setUsername(name);
    setUsernameConfirmed(true);
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
                  <span className="font-semibold text-green-400">
                    {msg.username || "You"}
                  </span>
                  <span className="text-muted">: </span>
                  <span className="text-foreground/90">{msg.content}</span>
                </>
              )}
            </div>
          ))}
          {messages.length === 0 && !loading && (
            <div className="text-center text-xs text-muted/60 py-8">
              No messages yet — say something!
            </div>
          )}
          {loading && (
            <div className="text-xs text-muted/60 italic">
              {streamerName} is reading chat...
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        {!usernameConfirmed ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirmUsername();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Enter your name to chat..."
              maxLength={20}
              className="flex-1 rounded-lg bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 outline-none ring-1 ring-border transition-shadow focus:ring-accent"
            />
            <button
              type="submit"
              disabled={!nameInput.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Join
            </button>
          </form>
        ) : (
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
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Chat
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
