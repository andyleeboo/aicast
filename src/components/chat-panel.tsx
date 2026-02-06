"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { validateMessage } from "@/lib/moderation";
import { dbRowToChatMessage } from "@/lib/types";
import type {
  ChatMessage,
  MessageRow,
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
  channelId,
  streamerId,
  streamerName,
  username,
  onAIResponse,
  onEmote,
  onSpeechBubble,
  onAudioData,
  isSpeaking,
}: {
  channelId: string;
  streamerId: string;
  streamerName: string;
  username: string;
  onAIResponse?: (gesture: GestureReaction) => void;
  onEmote?: (emote: EmoteCommand) => void;
  onSpeechBubble?: (text: string | null) => void;
  onAudioData?: (data: string) => void;
  isSpeaking?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const batchQueue = useRef<BatchedChatMessage[]>([]);
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Load initial messages + subscribe to Realtime
  useEffect(() => {
    let mounted = true;
    const supabase = getSupabase();

    // Load last 50 messages
    async function loadMessages() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(50);

      if (mounted && data) {
        setMessages(data.map(dbRowToChatMessage));
      }
    }

    loadMessages();

    // Subscribe to new messages via Realtime
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
          const row = payload.new as MessageRow;
          const msg = dbRowToChatMessage(row);
          setMessages((prev) => {
            // Skip if we already have this message
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [channelId]);

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

    // Build conversation history from recent messages for Gemini context
    const recentMessages = messagesRef.current.slice(-20);
    const history: ChatMessage[] = recentMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.role === "user" && m.username
          ? `${m.username}: ${m.content}`
          : m.content,
        timestamp: m.timestamp,
      }));

    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch,
          streamerId,
          history,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `API error ${res.status}`);
      }

      const data = (await res.json()) as ChatResponse;

      // AI response message arrives via Realtime subscription (inserted by API route)
      // We only use HTTP response for gesture/emote/audio callbacks
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

  async function send() {
    const text = input.trim();
    if (!text) return;

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

    // Client-side moderation
    const check = validateMessage(text);
    if (!check.valid) {
      setError(check.error ?? "Message rejected");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setError(null);
    setInput("");

    // INSERT user message into Supabase — it appears via Realtime for all viewers
    await getSupabase().from("messages").insert({
      channel_id: channelId,
      role: "user",
      content: text,
      username,
    });

    // Enqueue for batch (AI response)
    const batchMsg: BatchedChatMessage = {
      id: crypto.randomUUID(),
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
                    {msg.role === "user"
                      ? msg.username || "Anon"
                      : streamerName}
                  </span>
                  <span className="text-muted">: </span>
                  <span className="text-foreground/90">{msg.content}</span>
                </>
              )}
            </div>
          ))}
          {(loading || isSpeaking) && (
            <div className="text-sm">
              <span className="font-semibold text-accent">{streamerName}</span>
              <span className="text-muted"> {isSpeaking ? "is speaking" : "is typing"}</span>
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
      </div>
    </div>
  );
}
