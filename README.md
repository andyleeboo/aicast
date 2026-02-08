# AICast

AI live streaming platform — like Twitch, but every streamer is an AI.

Viewers join channels, watch a 3D AI avatar broadcast live, and chat with the AI streamer in real time. The AI reads chat like a real streamer — scanning batches of messages, picking the interesting ones, and addressing viewers by name.

Built with **Google Gemini 3** for the [Gemini 3 Hackathon](https://gemini3.devpost.com/).

## Live Demo

**[aicast.vercel.app](https://aicast.vercel.app)** — click "Watch Live" to join the stream.

## How It Works

1. **Pick a name** — enter a display name to join the chat
2. **Send messages** — your messages appear instantly in the chat feed
3. **Batch processing** — messages are collected over a ~3 second window, then sent to the AI as a batch (just like how a real streamer scans chat)
4. **AI responds** — the streamer reads the batch, picks messages to engage with, and responds while the 3D avatar performs gestures and emotes
5. **Keep chatting** — input is never locked; you can keep typing while the AI is responding

### Slash Commands

Type these in chat to trigger avatar emotes:

- `/wink` — Bob winks
- `/blink` — rapid blink emote
- `/sleep` — Bob falls asleep
- `/wake` — wake Bob up

## Gemini 3 Integration

AICast uses **`gemini-3-flash-preview`** as the core AI engine powering live streamer conversations.

**How Gemini 3 is central to the app:**

- **Streamer personality** — each AI streamer has a rich system prompt defining their character, humor style, and show format. Gemini 3 maintains this persona across the entire conversation.
- **Batch chat processing** — instead of responding to one message at a time, the AI receives batched chat messages formatted as `Username: message` and decides which to engage with, which to joke about, and when to acknowledge trends — mimicking how real streamers interact with chat.
- **Avatar action tags** — the system prompt instructs Gemini 3 to prefix responses with gesture/emote tags (`[NOD]`, `[SHAKE]`, `[TILT]`, `[WINK]`, `[BLINK]`, `[SLEEP]`). The server parses these tags and drives the 3D avatar's animations, creating a physical embodiment of the AI's reactions.
- **Text-to-Speech** — Gemini 2.5 Pro TTS generates Bob's voice in real time, with automatic fallback to Gemini 2.5 Flash TTS and then browser Web Speech API.
- **Priority-aware responses** — the batch system supports message priority levels (normal, highlighted, donation). Gemini 3 is instructed to always acknowledge donations and prioritize highlighted messages.

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| AI Chat | Google Gemini 3 Flash (`@google/genai`) |
| TTS | Gemini 2.5 Pro TTS → Flash TTS → Web Speech API |
| 3D Avatar | React Three Fiber + Three.js |
| Database | Supabase (auth + chat persistence) |
| Monitoring | Sentry (errors + session replay) |
| Analytics | Firebase Analytics |
| Deployment | Vercel |

## Architecture

```
Viewer (Browser)
  │
  ├─ ChatPanel ──── enqueue messages ──── 3s batch timer ──── flush
  │                                                            │
  │                                              POST /api/chat
  │                                              { batch, history }
  │                                                            │
  │                                              ┌─────────────▼──────────────┐
  │                                              │   API Route                │
  │                                              │   - Sort by priority       │
  │                                              │   - Format batch for AI    │
  │                                              │   - Compose system prompt  │
  │                                              │   - Call Gemini 3 Flash    │
  │                                              │   - Parse gesture/emote    │
  │                                              │   - Stream TTS audio       │
  │                                              └─────────────┬──────────────┘
  │                                                            │
  │◄──── SSE: ai-response + ai-audio-chunk ────────────────────┘
  │
  ├─ AvatarCanvas ── HeadScene ── FaceController (state machine)
  │     Gesture/emote tags drive avatar animations
  │
  ├─ AudioPlayer ── streams PCM audio chunks for Bob's voice
  │
  └─ Speech bubble overlay shows AI response text
```

### 3D Avatar System

The avatar is a procedural 3D head (no external models) driven by a **state machine animation controller**:

- **IdleState** — procedural head wander
- **GestureState** — quaternion keyframe playback (nod, shake, tilt)
- **WinkState / BlinkEmoteState / SleepState** — emote animations
- **PerformanceSkills** — dramatic camera/scale effects (14+ skills)
- Crossfade blending between states for smooth transitions

### TTS Provider Chain

Audio generation uses a fallback chain for reliability:

1. **Gemini 2.5 Pro TTS** — highest quality (~5s latency)
2. **Gemini 2.5 Flash TTS** — lower latency fallback
3. **Web Speech API** — browser-native, zero-cost, always available

### Avatar Remote Control

REST API at `/api/avatar/actions` + SSE event stream at `/api/avatar/events` allows external control of the avatar.

## Current Channel

**Late Night AI** — hosted by **Bob**, a witty AI talk show host with Conan O'Brien energy and Twitch streamer vibes. He roasts chat, does fake segments, and gives viewers nicknames.

## Development

```bash
bun install    # Install dependencies
bun dev        # Start dev server at localhost:3000
bun run build  # Production build
bun lint       # ESLint
```

## Environment Variables

```env
GEMINI_API_KEY=                          # Google AI Studio API key (required)
NEXT_PUBLIC_SUPABASE_URL=                # Supabase project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=    # Supabase publishable key
SENTRY_DSN=                              # Sentry DSN (server/edge)
NEXT_PUBLIC_SENTRY_DSN=                  # Sentry DSN (browser, same value)
SENTRY_AUTH_TOKEN=                       # Sentry auth token (CI/production only)
```

Get your Gemini API key at [Google AI Studio](https://aistudio.google.com/apikey).

## License

MIT
