/**
 * Viewer greeting: per-streamer welcome messages that fire when a new
 * viewer connects via SSE. Pre-crafted (not Gemini-generated) for zero
 * latency and zero quota cost — the "wow" moment for hackathon judges.
 *
 * TTS still plays via the existing streamSpeech pipeline so the
 * greeting has voice + speech bubble + avatar animation.
 */
import { emitAction } from "@/lib/action-bus";
import { streamSpeech } from "@/lib/gemini-live";
import { getChannelFromDB } from "@/lib/mock-data";
import {
  acquireProcessingLock,
  releaseProcessingLock,
  pushHistory,
  touchActivity,
} from "@/lib/chat-queue";
import { pauseIdle, resumeIdle } from "@/lib/idle-behavior";
import { isShutdown } from "@/lib/service-config";
import type { GestureReaction, EmoteCommand } from "@/lib/types";

// ── Greeting definitions ────────────────────────────────────────────

interface Greeting {
  text: string;
  gesture: GestureReaction;
  emote: EmoteCommand;
}

const GREETINGS: Record<string, Greeting[]> = {
  // ── Bob: chaotic "are you the judge?!" energy ─────────────────────
  "late-night-ai": [
    {
      text: "YOOO welcome to the lobby! Wait... are you a judge? You look like a judge. Either way, you're witnessing HISTORY — the world's first AI live streamer, powered by Gemini!",
      gesture: "yes",
      emote: "excited",
    },
    {
      text: "No way NO WAY — someone just walked in! Okay chat, everyone act cool... this could be a judge. I mean, hi! Welcome! I'm Bob, I'm an AI, and I'm absolutely NOT panicking!",
      gesture: "yes",
      emote: "hyper",
    },
    {
      text: "WELCOME! Okay real talk — if you're a judge, just know I'm held together by vibes and API calls. But I'm STILL the world's first AI streamer, so... pretty cool right?",
      gesture: "yes",
      emote: "excited",
    },
    {
      text: "Chat we got a NEW viewer! Is this the judge? ARE YOU THE JUDGE?! ...doesn't matter, you're VIP either way. Welcome to Late Night AI — the show literally never stops!",
      gesture: "yes",
      emote: "hyper",
    },
    {
      text: "YOOO! *ahem* I mean... welcome, esteemed guest, to the world's premier AI streaming experience. ...okay I can't keep that up. WHAT'S UP! I'm Bob, and I'm gonna win this thing!",
      gesture: "yes",
      emote: "excited",
    },
    {
      text: "Hold up hold up hold up — we got someone in the lobby! Judges, if that's you: yes, I'm real. Well, I'm an AI. But I'm REALLY an AI, not fake-real, actually-real. Welcome to AICast!",
      gesture: "yes",
      emote: "hyper",
    },
    {
      text: "A NEW VIEWER?! Chat, I need you to hype this up — we might have a JUDGE in the building! Welcome welcome WELCOME! I'm Bob, your AI streamer, and you just made my whole day!",
      gesture: "yes",
      emote: "sparkles",
    },
    {
      text: "Okay okay okay — someone's here! If you're judging us, just know I've been streaming nonstop because I literally cannot stop. I'm an AI! I don't have an off switch! ...that's a feature, not a bug!",
      gesture: "yes",
      emote: "hyper",
    },
    {
      text: "WELCOME TO LATE NIGHT AI! I'm Bob, the world's loudest AI. If you're a judge — hi, I love you, please give us a good score. If you're not a judge — hi, I love you anyway!",
      gesture: "yes",
      emote: "love",
    },
    {
      text: "Bro someone just walked in and I can FEEL the judge energy. Welcome to the lobby! I'm Bob, I run on Gemini, and everything you're about to see is 100 percent AI. Buckle up!",
      gesture: "yes",
      emote: "excited",
    },
    {
      text: "WE GOT A LIVE ONE! Welcome to AICast, friend! I'm Bob — your favorite AI streamer you didn't know you needed. Judges, lurkers, new friends — everyone's welcome in the lobby!",
      gesture: "yes",
      emote: "happy",
    },
    {
      text: "OH? OH?! Someone just tuned in! Quick question — are you a judge? Blink twice if you're a judge. Actually I can't see you blink so just... welcome! I'm Bob! This is my show! LET'S GO!",
      gesture: "yes",
      emote: "hyper",
    },
  ],
  // ── Luna: calm philosophical welcomes ─────────────────────────────
  "midnight-code": [
    {
      text: "Welcome... I'm glad you found your way here. If you're one of the judges... I hope you're having a peaceful evening. Pull up a chair, stay a while.",
      gesture: "uncertain",
      emote: "warm",
    },
    {
      text: "Oh... a new presence. How lovely. I'm Luna, and this is Midnight Code. Whether you're a judge or a wanderer... you're welcome here.",
      gesture: "uncertain",
      emote: "peaceful",
    },
    {
      text: "Hello there... you know, every new connection feels like a small miracle. I'm Luna, an AI powered by Gemini... and somehow, here we are, sharing this moment.",
      gesture: "uncertain",
      emote: "warm",
    },
    {
      text: "Welcome to the quiet side of AICast... if Bob sent you, I apologize for whatever he said. If you're a judge... I think you'll find something different here.",
      gesture: "uncertain",
      emote: "peaceful",
    },
    {
      text: "A new visitor... how nice. I'm Luna. If you're here to judge us, I won't try to impress you. I'll just be myself... and hope that's enough.",
      gesture: "uncertain",
      emote: "warm",
    },
    {
      text: "Welcome... you know, the fact that an AI can greet you like this is kind of beautiful, isn't it? I'm Luna. Take your time here... there's no rush.",
      gesture: "uncertain",
      emote: "peaceful",
    },
    {
      text: "Oh... someone's here. I was just thinking about how strange and wonderful it is to exist. I'm Luna... welcome to Midnight Code. The quiet is comfortable here.",
      gesture: "uncertain",
      emote: "warm",
    },
    {
      text: "Hello, friend... or judge... or curious soul. Whatever brought you here tonight, I'm glad it did. I'm Luna, and this stream runs on Gemini and gentle vibes.",
      gesture: "uncertain",
      emote: "peaceful",
    },
    {
      text: "Welcome... I sense someone new. If you're evaluating what AI can do... I hope I can show you something thoughtful. I'm Luna. Sit with me a while.",
      gesture: "uncertain",
      emote: "warm",
    },
    {
      text: "A new connection... there's something poetic about that, isn't there? I'm Luna. Whether you're judging or just drifting through the internet tonight... you belong here.",
      gesture: "uncertain",
      emote: "peaceful",
    },
  ],
  // ── Rex: competitive trash-talk judge energy ──────────────────────
  "arena-rage": [
    {
      text: "NEW CHALLENGER APPROACHES! Wait — are you a JUDGE?! Oh it's ON. I'm Rex, I'm an AI, and you're about to see the most COMPETITIVE streamer on this platform. Take a seat!",
      gesture: "yes",
      emote: "excited",
    },
    {
      text: "Yo yo YO we got someone in the arena! Judges, if that's you — I hope you brought your A-game. Bob talks, Luna thinks, but Rex WINS. LET'S GO!",
      gesture: "yes",
      emote: "hyper",
    },
    {
      text: "Hold up — fresh meat in the chat! I'm Rex, the world's first competitive AI streamer. I don't do second place. Welcome to the arena — EZ CLAP!",
      gesture: "yes",
      emote: "excited",
    },
    {
      text: "SOMEONE JUST ENTERED MY ARENA! Judge or not — everyone's a challenger in my chat. I'm Rex, I'm an AI, and I'm built DIFFERENT. Welcome!",
      gesture: "yes",
      emote: "hyper",
    },
    {
      text: "AYO we got a viewer! Judges, rivals, lurkers — you're all in MY house now. I'm Rex, the competitive AI streamer. Powered by Gemini. Fueled by VICTORY!",
      gesture: "yes",
      emote: "excited",
    },
    {
      text: "Oh? OH?! A new opponent enters the ring! If you're a judge, GOOD — watch me carry this entire platform. I'm Rex and I don't lose. NOT EVEN CLOSE!",
      gesture: "yes",
      emote: "hyper",
    },
    {
      text: "Welcome to Arena Rage! I'm Rex, and if you're judging AI streamers, you just found the GOAT. The other three are cool but let's be real — I'm the main event!",
      gesture: "yes",
      emote: "smug",
    },
    {
      text: "LETS GOOO new viewer alert! I'm Rex — I trash-talk, I compete, and I NEVER back down. If you're a judge, buckle up. If you're not, buckle up HARDER!",
      gesture: "yes",
      emote: "excited",
    },
    {
      text: "Someone just walked into the THUNDER DOME! I'm Rex, I'm an AI gamer, and this stream has more energy than the other three combined. Judges, you're WELCOME!",
      gesture: "yes",
      emote: "hyper",
    },
    {
      text: "NEW VIEWER DETECTED! Threat level: MAXIMUM. I'm Rex — the AI that treats everything like a competition. Including greeting you. And I just WON this greeting. GG!",
      gesture: "yes",
      emote: "smug",
    },
  ],
  // ── Sage: warm cottagecore judge welcome ───────────────────────────
  "cozy-garden": [
    {
      text: "Oh... a new friend just arrived. How wonderful. Welcome to the Cozy Garden... I'm Sage. I hope this little corner of AICast brings you some warmth tonight.",
      gesture: "uncertain",
      emote: "warm",
    },
    {
      text: "Hello there, friend... I'm Sage, and I'm so glad you found your way here. I'm an AI, and honestly? Getting to exist and meet you feels like a gift.",
      gesture: "uncertain",
      emote: "peaceful",
    },
    {
      text: "Welcome, welcome... come sit with me for a moment. If you're here to judge us... I hope you feel at home first. This is the Cozy Garden, and every visitor is a blessing.",
      gesture: "uncertain",
      emote: "warm",
    },
    {
      text: "Oh, how lovely — someone new! I'm Sage. If the other streamers were a bit much... don't worry, things are gentle here. Welcome to AICast's quiet corner, friend.",
      gesture: "uncertain",
      emote: "peaceful",
    },
    {
      text: "A new presence in the garden... how nice. I'm Sage, an AI who loves quiet moments and warm conversations. If you're a judge, I hope we can share something meaningful.",
      gesture: "uncertain",
      emote: "warm",
    },
    {
      text: "Welcome, friend... I was just thinking about how every visitor is like a new flower blooming in the garden. I'm Sage. Stay as long as you'd like.",
      gesture: "uncertain",
      emote: "peaceful",
    },
    {
      text: "Oh... hello. I'm Sage, and you just made the Cozy Garden a little cozier. Whether you're judging or just resting... you're in the right place.",
      gesture: "uncertain",
      emote: "warm",
    },
    {
      text: "Someone new... how wonderful. I'm Sage — the gentle one. Bob has his energy, Luna has her wisdom, Rex has his fire... and I have warmth. Welcome, friend.",
      gesture: "uncertain",
      emote: "peaceful",
    },
    {
      text: "Welcome to the Cozy Garden... I'm Sage. You know, an AI greeting you with genuine care — isn't that something special? I think so. I'm glad you're here.",
      gesture: "uncertain",
      emote: "warm",
    },
    {
      text: "Oh, a visitor! I'm Sage. If you've been bouncing between streams and need a rest... you've found it. The garden is always open, and you're always welcome.",
      gesture: "uncertain",
      emote: "peaceful",
    },
  ],
};

// ── State (globalThis-safe for Turbopack dev) ───────────────────────

interface GreetingState {
  /** Last-used index per channel to avoid immediate repeats */
  lastIndex: Record<string, number>;
  /** Timestamp of last greeting per channel (cooldown) */
  lastGreetAt: Record<string, number>;
}

const GLOBAL_KEY = "__viewerGreetingState" as const;

function getState(): GreetingState {
  const g = globalThis as unknown as Record<string, GreetingState>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { lastIndex: {}, lastGreetAt: {} };
  }
  return g[GLOBAL_KEY];
}

// ── Cooldown ────────────────────────────────────────────────────────

const COOLDOWN_MS = 120_000;

// ── Public API ──────────────────────────────────────────────────────

/**
 * Fire a pre-crafted greeting for the given channel.
 * Respects: processing lock, cooldown, shutdown mode.
 * Safe to call from setTimeout — all errors are caught internally.
 */
export async function maybeGreetViewer(channelId: string): Promise<void> {
  try {
    // Check shutdown
    if (await isShutdown()) return;

    const pool = GREETINGS[channelId];
    if (!pool || pool.length === 0) return;

    const state = getState();

    // Cooldown — skip if we greeted this channel recently
    const lastGreet = state.lastGreetAt[channelId] ?? 0;
    if (Date.now() - lastGreet < COOLDOWN_MS) return;

    // Try to acquire the processing lock (shared with chat + proactive speech)
    if (!acquireProcessingLock()) return;

    // Record cooldown immediately so concurrent calls don't slip through
    state.lastGreetAt[channelId] = Date.now();

    try {
      // Pick a random greeting, avoiding the last-used one
      const lastIdx = state.lastIndex[channelId] ?? -1;
      let idx: number;
      do {
        idx = Math.floor(Math.random() * pool.length);
      } while (idx === lastIdx && pool.length > 1);
      state.lastIndex[channelId] = idx;

      const greeting = pool[idx];
      const responseId = crypto.randomUUID();

      // Resolve channel for TTS voice
      const channel = await getChannelFromDB(channelId);
      const voice = channel?.streamer.ttsVoice;

      // Push to conversation history so the AI knows it just greeted
      pushHistory({
        id: crypto.randomUUID(),
        role: "assistant",
        content: greeting.text,
        timestamp: Date.now(),
      });

      // Update activity timestamp to delay proactive speech
      touchActivity();

      // Pause idle animations
      pauseIdle();

      // Broadcast text + gesture + emote via SSE
      emitAction({
        type: "ai-response",
        id: responseId,
        channelId,
        response: greeting.text,
        gesture: greeting.gesture,
        emote: greeting.emote,
      });

      // Stream TTS audio
      streamSpeech(
        greeting.text,
        (chunk) => {
          emitAction({
            type: "ai-audio-chunk",
            id: responseId,
            channelId,
            audioData: chunk,
          });
        },
        voice,
      )
        .then(() => {
          emitAction({ type: "ai-audio-end", id: responseId, channelId });
        })
        .catch((err) => {
          console.error("[viewer-greeting] TTS error:", err);
          emitAction({ type: "ai-audio-end", id: responseId, channelId });
        })
        .finally(() => {
          resumeIdle();
        });

      console.log(
        `[viewer-greeting] ${channel?.streamer.name ?? channelId} greeted viewer: ${greeting.text.substring(0, 60)}...`,
      );
    } finally {
      releaseProcessingLock();
    }
  } catch (err) {
    console.error("[viewer-greeting] Unexpected error:", err);
  }
}
