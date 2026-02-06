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
  streamerId,
  streamerName,
  onAIResponse,
  onEmote,
  onSpeechBubble,
  onAudioData,
  isSpeaking,
}: {
  streamerId: string;
  streamerName: string;
  onAIResponse?: (gesture: GestureReaction) => void;
  onEmote?: (emote: EmoteCommand) => void;
  onSpeechBubble?: (text: string | null) => void;
  onAudioData?: (data: string) => void;
  isSpeaking?: boolean;
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

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMsg]);
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
      if (slashCmd.emote) onEmote?.(slashCmd.emote);
      if (slashCmd.gesture) onAIResponse?.(slashCmd.gesture);
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
                  <span
                    className={`font-semibold ${
                      msg.role === "user" ? "text-green-400" : "text-accent"
                    }`}
                  >
                    {msg.role === "user"
                      ? msg.username || "You"
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
