"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage, GestureReaction, EmoteCommand } from "@/lib/types";

const RANDOM_FACTS: { text: string; gesture: GestureReaction }[] = [
  { text: "A group of flamingos is called a 'flamboyance.' Honestly, that's the best collective noun ever.", gesture: "yes" },
  { text: "Honey never spoils. Archaeologists have found 3,000-year-old honey in Egyptian tombs that was still perfectly edible.", gesture: "yes" },
  { text: "Octopuses have three hearts and blue blood. Two pump blood to the gills, one pumps it to the rest of the body.", gesture: "yes" },
  { text: "Bananas are berries, but strawberries are not. Botany is basically gaslighting us at this point.", gesture: "uncertain" },
  { text: "There are more possible iterations of a game of chess than there are atoms in the known universe. Let that sink in.", gesture: "yes" },
  { text: "Wombat poop is cube-shaped. They use it to mark territory, and the cubes don't roll away. Nature is efficient.", gesture: "uncertain" },
  { text: "The inventor of the Pringles can is buried in one. His name was Fredric Baur. Respect.", gesture: "yes" },
  { text: "Venus is the only planet that spins clockwise. It's basically the contrarian of the solar system.", gesture: "no" },
  { text: "A jiffy is an actual unit of time — it's 1/100th of a second. So 'I'll be there in a jiffy' is a lie.", gesture: "no" },
  { text: "Cows have best friends and get stressed when separated. Even cows need their ride-or-die.", gesture: "yes" },
  { text: "The shortest war in history lasted 38 minutes — between Britain and Zanzibar in 1896.", gesture: "uncertain" },
  { text: "Sea otters hold hands when they sleep so they don't drift apart. That's peak wholesome.", gesture: "yes" },
  { text: "The total weight of all ants on Earth is roughly equal to the total weight of all humans. Ants are low-key winning.", gesture: "uncertain" },
  { text: "Scotland's national animal is the unicorn. Not making that up. It's been their thing since the 12th century.", gesture: "yes" },
  { text: "You can hear a blue whale's heartbeat from over 2 miles away. That's a serious sound system.", gesture: "yes" },
];

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
}: {
  streamerId: string;
  streamerName: string;
  onAIResponse?: (gesture: GestureReaction) => void;
  onEmote?: (emote: EmoteCommand) => void;
  onSpeechBubble?: (text: string | null) => void;
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

    // Simulate a short delay then pick a random hardcoded fact
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));

    const fact = RANDOM_FACTS[Math.floor(Math.random() * RANDOM_FACTS.length)];
    const emotes: (EmoteCommand | null)[] = ["wink", "blink", null, null];
    const randomEmote = emotes[Math.floor(Math.random() * emotes.length)];

    const aiMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: fact.text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, aiMsg]);
    onAIResponse?.(fact.gesture);
    onSpeechBubble?.(fact.text);
    if (randomEmote) {
      onEmote?.(randomEmote);
    }
    setLoading(false);
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
