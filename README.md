# AICast

AI live streaming platform — like Twitch, but every streamer is an AI.

Viewers watch a 3D AI avatar broadcast live and chat with the AI streamer in real time. The AI reads chat like a real streamer — scanning batches of messages, picking the interesting ones, addressing viewers by name, and going on unprompted tangents when chat is quiet.

Built with **Google Gemini 3** for the [Gemini 3 Hackathon](https://gemini3.devpost.com/).

## Live Demo

**[aicast.vercel.app](https://aicast.vercel.app)** — jump in, pick a name, start chatting.

## What You Get

### The Stream Experience

1. **Pick a name** — a modal suggests a random display name, or type your own
2. **Chat with Bob** — your messages appear instantly; the server batches them over ~3 seconds (like a real streamer scanning chat) and sends them to Gemini 3 Flash
3. **Bob responds via voice + speech bubble** — he doesn't type in chat. His text appears as a floating speech bubble over his 3D avatar while TTS plays his voice
4. **Bob moves** — every response comes with head gestures, facial expressions, and sometimes dramatic camera/scale effects
5. **Bob never shuts up** — when chat goes quiet for 45–90 seconds, he starts monologuing on his own (hot takes, existential comedy, challenges to viewers)
6. **Bob fidgets** — even between responses, he randomly emotes, gestures, and does performance skills every 8–20 seconds

### Slash Commands

Type these in chat to control Bob directly:

| Command | What Happens |
|---------|-------------|
| `/nod` | Bob nods yes |
| `/shake` | Bob shakes his head no |
| `/wink` | Wink at chat |
| `/blink` | Deliberate blink |
| `/sleep` | Bob falls asleep (blocks everything until `/wake`) |
| `/wake` | Wake him up |
| `/spin` | Bob spins — **stackable!** Consecutive spins get faster and longer |
| `/happy` `/sad` `/angry` `/uwu` `/cool` `/love` `/dead` `/mindblown` ... | 28+ emotion commands (150+ expressions total) |
| `/hangman` | Start a Hangman game |
| `/guess <letter or word>` | Guess in Hangman |
| `/endgame` | Force-end the current game |

### Hangman

Type `/hangman` and a whiteboard overlay slides in next to Bob:

- SVG stick-figure gallows drawn progressively (6 wrong guesses = game over)
- 80 words across 8 categories (animals, movies, tech, food, music, sports, nature, space)
- **Bob is game-aware** — his AI prompt includes the game state. He reacts to guesses, gives vague hints when chat struggles, builds hype when you're close, and celebrates or roasts on win/loss
- Bob slides to the left and shrinks to make room for the game board
- 30-second cooldown between games

### 150+ Expressions

Bob's face is kaomoji-style text characters. Examples:

| Expression | Face |
|-----------|------|
| Happy | `^ω^` |
| Sad | `T_T` |
| Surprised | `◎○◎` |
| Love | `♥ω♥` |
| Dead | `×_×` |
| UwU | `◠ω◠` |

Full categories: happy variants (10), sad (10), angry (10), surprise (10), love (10), smug (10), confused (10), scared (10), cute/kawaii (10), silly/goofy (10), cool (10), tired (10), disgust (10), special/dramatic (20), plus core emotions and physical actions.

### Performance Skills

The AI can trigger scene-level animations during responses — Bob moves in 3D space:

| Skill | Effect |
|-------|--------|
| `DRAMATIC_ZOOM` | Zooms toward camera |
| `POWER_UP` | Grows 35% bigger |
| `SMOL_SHY` | Shrinks to 60% |
| `FLOAT_UP` | Ascends with sparkles |
| `RAGE_ZOOM` | Angry zoom-in |
| `GIGACHAD` | Huge (1.4x) + smug |
| `UWU_TINY` | Tiny (0.45x) + cute |
| `THINKING_CORNER` | Drifts to the left |
| `MIND_BLOWN` | Pulls back + grows |
| `DRAMATIC_ENTRANCE` | Far away tiny, approaching |
| ...and 5 more | |

### Spin Stacking

`/spin` is stackable — consecutive spins compound:

- Base: 2 rev/s for 2 seconds
- Each additional spin: +1.5 rev/s, +2s duration (max 10s)
- Expression evolves through levels: `@○@` → `@Д@` → `×○×` → `★▽★`

## Bob's Personality

Bob isn't a generic chatbot. He's a specific character:

- **"Chaos Agent with main-character energy"** — Kai Cenat's unhinged hype meets a self-aware AI
- Fully aware he's a hackathon project (begs for votes)
- Catchphrases: "YOOO", "chat we are SO back", "bro WHAT"
- Gives viewers nicknames based on their username
- Calls the community "chat" or "the lobby"
- Emotional range: Hype → Dramatic → Tilted → Wholesome → Scheming → Existential comedy
- Hard-capped at 1–3 sentences per response

## How It Works

```
Viewer (Browser)
  │
  ├─ ChatPanel ─── POST /api/chat ─── Supabase (persist)
  │                                         │
  │                           SSE endpoint polls every 3s
  │                                         │
  │                              ┌──────────▼──────────────┐
  │                              │  processChatBatch()      │
  │                              │  - Batch viewer messages  │
  │                              │  - Build system prompt    │
  │                              │    (personality + actions  │
  │                              │     + game context)       │
  │                              │  - Call Gemini 3 Flash    │
  │                              │  - Parse gesture/emote    │
  │                              │    tags from response     │
  │                              │  - Stream TTS audio       │
  │                              └──────────┬──────────────┘
  │                                         │
  │◄── SSE: ai-response ───────────────────┘
  │◄── SSE: ai-audio-chunk ────────────────┘
  │◄── SSE: game-state ───────────────────┘
  │
  ├─ BroadcastContent (orchestrator)
  │    Routes events → avatar, speech bubble, audio, game overlay
  │
  ├─ AvatarCanvas → FaceController (state machine)
  │    Gesture/emote/skill tags drive animations
  │
  ├─ useAudioPlayer → Web Audio API (streaming PCM playback)
  │    Falls back to browser Web Speech API
  │
  ├─ useSpeechBubble → floating text overlay
  │
  └─ GameOverlay → HangmanBoard (SVG whiteboard)
```

### Real-Time via SSE

Everything flows through a single SSE endpoint (`/api/avatar/events`). No WebSockets — SSE works on Vercel's serverless runtime with a 60-second max connection. The server sends a `reconnect` hint at 55 seconds and the browser's native `EventSource` auto-reconnects.

**Event types:**

| Event | Data |
|-------|------|
| `ai-response` | Text + gesture/emote/skill tags + language hint |
| `ai-audio-chunk` | Streaming base64 PCM audio |
| `ai-audio-end` | Audio complete (triggers browser fallback if no audio received) |
| `game-state` | Hangman state (word, guesses, wrong count, status) |
| `maintenance-mode` | System status |
| `reconnect` | Graceful disconnect hint |

### TTS Provider Chain

Audio generation uses a fallback chain:

1. **Gemini 2.5 Pro TTS** — highest quality, "Puck" voice (~5s latency)
2. **Web Speech API** — browser-native, zero-cost, always available

Rate-limited to 3 calls per 60 seconds to stay within free-tier quota. When over budget, the client falls back to browser speech automatically.

Audio format: 24kHz mono 16-bit PCM, base64-encoded, streamed as SSE chunks.

### 3D Avatar System

The avatar is a **procedural 3D head** (no loaded models) driven by a state machine animation controller:

- **IdleState** — procedural head wander with random blinks every 3–5s
- **GestureState** — quaternion keyframe playback from JSON files (nod, shake, tilt)
- **WinkState** — right eye close + head tilt, held 2s
- **BlinkEmoteState** — deliberate fast blink (~180ms)
- **SleepState** — head droops 44°, eyes close, breathing animation. Blocks everything until wake
- **SpinState** — stackable rotation with evolving expressions
- **ExpressionEmoteState** — 150+ kaomoji faces, held ~3.5s
- Crossfade blending between all states for smooth transitions
- Pre-allocated Three.js objects at module scope (zero GC pressure)

### Action Bus

An in-memory pub/sub (`action-bus.ts`) connects all event sources to the SSE endpoint:

- **Emitters**: chat processor, idle behavior, proactive speech, game manager, remote control API
- **Consumer**: SSE endpoint broadcasts to all connected viewers

### Avatar Remote Control

REST API at `/api/avatar/actions`:

- **GET** — lists all available actions (gestures, emotes, skills)
- **POST** `{ "actionId": "emote:happy" }` — triggers an action on Bob

This is the foundation for letting external AI agents interact with the platform.

## Gemini 3 Integration

AICast uses **`gemini-3-flash-preview`** as the core AI engine.

- **Streamer personality** — rich system prompt defining Bob's character, humor, and show format
- **Batch chat processing** — messages formatted as `Username: message`, AI decides which to engage with (like a real streamer scanning chat)
- **Avatar action tags** — Gemini prefixes responses with tags like `[NOD] [HAPPY]` which the server parses to drive avatar animations
- **Performance skills** — Gemini can trigger scene-level effects (`[DRAMATIC_ZOOM]`, `[POWER_UP]`, etc.)
- **Game awareness** — when Hangman is active, the AI prompt includes game state so Bob reacts naturally to guesses
- **Priority-aware** — batch system supports message priority (normal, highlighted, donation). Gemini always acknowledges donations
- **Multilingual** — responds in the viewer's language, tags non-English with `[LANG:ko]` for TTS voice selection
- **Proactive speech** — generates monologues when chat is quiet, instructed to vary topics

**Exception**: TTS uses Gemini 2.5 models (Gemini 3 doesn't support audio output).

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) + TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| AI Chat | Google Gemini 3 Flash (`@google/genai`) |
| TTS | Gemini 2.5 Pro TTS → Web Speech API |
| 3D Avatar | React Three Fiber + Three.js |
| Database | Supabase (anonymous auth + chat persistence + realtime) |
| Real-time | Server-Sent Events (SSE) |
| Audio | Web Audio API (streaming 24kHz PCM) |
| Monitoring | Sentry |
| Deployment | Vercel |
| Package Manager | Bun |

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/chat` | Receive chat messages, persist to Supabase |
| GET | `/api/avatar/events` | SSE stream (all real-time events) |
| GET | `/api/avatar/actions` | List available actions |
| POST | `/api/avatar/actions` | Trigger an action remotely |
| GET | `/api/game` | Current game state |
| POST | `/api/game` | Game commands (start, guess, stop) |
| GET | `/api/viewers` | Current viewer count |

## Data (Supabase)

- **`messages`** — chat history (user + assistant messages, per channel)
- **`channels`** / **`streamers`** — exist but fall back to hardcoded data for Bob
- **Auth**: anonymous (no sign-in required), cookie-based session via `@supabase/ssr`
- **Realtime**: subscribes to INSERT events on `messages` + polling fallback

## What's Scaffolded But Not Built Yet

- **Donations** — type system has `MessagePriority`, `donationAmount`, `donationCurrency`. AI prompt acknowledges `[DONATION $X]` messages. No payment processing or UI.
- **Multi-agent access** — remote control API exists (`/api/avatar/actions`). No agent docs or authentication yet.
- **Multiple channels** — route exists (`/live/[id]`), only "late-night-ai" is live.

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
