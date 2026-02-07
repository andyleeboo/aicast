# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is AICast

AI live streaming platform (Twitch for AI). Viewers watch AI-generated broadcasts and chat with AI streamers in real time. Currently in early development with a single hardcoded channel ("Late Night AI" hosted by "Bob"). Built for the **Gemini 3 Hackathon** on Devpost (deadline Feb 10, 2026).

## Commands

```bash
bun dev           # Start dev server at localhost:3000
bun run build     # Production build
bun lint          # ESLint (flat config, eslint.config.mjs)
```

Use **bun** as the package manager (`bun install`, `bun add <pkg>`).

## Environment Variables

- `GEMINI_API_KEY` — Google AI Studio API key (required for AI chat; without it, the Gemini client lazy-inits with an empty key)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (e.g. `https://<ref>.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key (format: `sb_publishable_...`). **Not** the legacy `anon` JWT — Supabase now uses publishable keys.
- `SENTRY_DSN` — Sentry Data Source Name for server/edge error tracking
- `NEXT_PUBLIC_SENTRY_DSN` — Sentry DSN for browser error tracking (same value as `SENTRY_DSN`)
- `SENTRY_AUTH_TOKEN` — Sentry auth token for source map uploads (only needed in CI/production builds)

## Tech Stack

- **Next.js 16** (App Router) + TypeScript (strict mode)
- **Tailwind CSS v4** (using `@import "tailwindcss"` in globals.css, not v3 `@tailwind` directives)
- **React Three Fiber + Three.js** for the 3D avatar
- **Google Gemini 3** (`@google/genai`, model: `gemini-3-flash-preview`) for AI chat responses
- **Google Gemini 2.5 TTS** (model: `gemini-2.5-pro-preview-tts`) for text-to-speech with **Web Speech API** browser fallback when server TTS fails
- **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`) for auth and database. Anonymous auth is enabled.
- Path alias: `@/*` maps to `./src/*`

## Architecture

### Page Structure

- `/` — Landing page with hero CTA linking to the single live channel
- `/live/[id]` — Stream viewer page: 3D avatar + chat panel side by side

### Data Flow: Chat → Avatar Animation → Speech

1. User types in `ChatPanel` → POST to `/api/chat` with message + batch queue
2. Server batches messages for ~3s, then appends `buildActionSystemPrompt()` to the streamer's personality, calls Gemini 3 Flash
3. Gemini response starts with `[GESTURE_TAG] [EMOTE_TAG] text...` — server parses and strips tags
4. Server broadcasts `ai-response` event via SSE (action-bus → `/api/avatar/events`)
5. Server streams TTS audio via the provider chain (Gemini 2.5 Pro TTS → Flash TTS fallback)
6. `BroadcastContent` (client orchestrator) receives events, triggers avatar animation + speech bubble + audio playback
7. If no server audio arrives, client falls back to browser Web Speech API

**Bob is speech-only** — his responses appear as voice audio + speech bubble overlay on the 3D avatar. Bob does NOT appear in the chat panel. The chat panel shows only viewer messages. Supabase only persists user messages (no assistant messages).

Chat uses a **batch system**: messages are collected for ~3 seconds server-side, then sent as a single batch to Gemini. The AI sees "who said what" and responds like a real streamer scanning chat. Users pick a display name before chatting.

### 3D Avatar System (`src/components/avatar/`)

The avatar uses a **state machine animation controller** (`FaceController`):

- **States**: `IdleState` (procedural wander), `GestureState` (recorded quaternion playback), `WinkState`, `BlinkEmoteState`, `SleepState`
- Each state implements `AnimationState` interface: `enter()`, `update(dt, elapsed, outPose)`, `exit()`
- **Crossfade blending** between states using `FacePose` (head quaternion + eye scales)
- **Gesture data** loaded from JSON files in `public/gestures/` (pre-recorded quaternion keyframe sequences)
- `useFaceAnimation` hook connects the controller to React Three Fiber's `useFrame` loop
- `HeadGeometry` is a simple procedural head (sphere + eyes + nose + ears) — no loaded 3D models

### Avatar Action System

- Actions are defined in `src/lib/avatar-actions.ts` with gesture tags (NOD, SHAKE, TILT) and emote tags (WINK, BLINK, SLEEP, WAKE)
- `buildActionSystemPrompt()` generates the system prompt suffix instructing Gemini to use these tags
- **Remote control**: REST API at `/api/avatar/actions` (GET lists actions, POST triggers one) → emits through `action-bus.ts` (in-memory pub/sub) → SSE stream at `/api/avatar/events` → client `EventSource` in `BroadcastContent`

### TTS System (`src/lib/gemini-live.ts`)

Uses a **provider chain** pattern — tries each TTS provider in order until one delivers audio:

1. `gemini-2.5-pro-preview-tts` (primary — higher quality, ~5s latency)
2. `gemini-2.5-flash-preview-tts` (fallback — lower latency but may share quota)

If all server providers fail (quota exhaustion, timeout), the client automatically falls back to the **Web Speech API** (`window.speechSynthesis`) in `broadcast-content.tsx`. This is zero-cost and always available.

The `TtsProvider` interface in `gemini-live.ts` makes it easy to add new providers (e.g., Google Cloud TTS, ElevenLabs) — just implement `generateSpeech(text, onChunk)` and add to the `providers` array.

Audio format: 24 kHz mono 16-bit PCM (base64-encoded), streamed as SSE events (`ai-audio-chunk`) to the client's `useAudioPlayer` hook.

### Supabase Client (`src/utils/supabase/`)

Three client factories following the `@supabase/ssr` pattern:

- **`client.ts`** — `createClient()` for browser/Client Components (uses `createBrowserClient`)
- **`server.ts`** — `async createClient()` for Server Components/Route Handlers (calls `await cookies()` internally)
- **`middleware.ts`** — `async updateSession(request)` for the Next.js middleware; refreshes auth tokens via `supabase.auth.getUser()`

The root `src/middleware.ts` calls `updateSession()` on page requests. API routes (`/api/*`) are excluded from middleware to avoid auth overhead on SSE streams and chat endpoints.

### Design Tokens

Dark theme only (hardcoded `<html class="dark">`). Colors defined as CSS custom properties in `globals.css` and mapped to Tailwind v4 theme via `@theme inline`. Key tokens: `--accent: #9147ff` (purple), `--live: #eb0400` (red), `--surface: #18181b`.

## Worktree Workflow

Feature development uses **git worktrees** in `.worktrees/` (gitignored) to isolate work from the main checkout.

### Creating a worktree for a new feature

```bash
git worktree add .worktrees/<name> -b <branch-name>
# Example:
git worktree add .worktrees/chat-streaming -b feature/chat-streaming
```

Then work inside `.worktrees/<name>/` — it's a full checkout with its own `node_modules` (run `bun install` after creating).

### Opening a PR from a worktree

```bash
cd .worktrees/<name>
git push -u origin <branch-name>
gh pr create --title "..." --body "..."
```

### Cleanup after merge

```bash
git worktree remove .worktrees/<name>
git branch -d <branch-name>
```

### Rules

- **Never commit from the main checkout** for feature work — always use a worktree
- Each worktree = one branch = one PR
- The main checkout stays on `main` and is used for reviews, rebases, and running the app
- Run `bun install` inside each new worktree (they don't share `node_modules`)

## Conventions

- All client components are explicitly marked with `"use client"`
- Three.js objects are pre-allocated at module scope to avoid GC pressure (see `face-controller.ts`)
- Emote commands use a cooldown/lock pattern in `BroadcastContent` to prevent spam
- Chat slash commands (`/wink`, `/blink`, `/sleep`, `/wake`) are handled client-side in `ChatPanel`

## Rules

- **Always use Gemini 3 for chat/reasoning** — this project is for the Gemini 3 Hackathon. The chat model in `src/lib/gemini.ts` must be a `gemini-3-*` model (currently `gemini-3-flash-preview`). **Exception**: TTS uses Gemini 2.5 models because Gemini 3 does not support audio output. The TTS provider chain in `src/lib/gemini-live.ts` uses `gemini-2.5-pro-preview-tts` (primary) and `gemini-2.5-flash-preview-tts` (fallback).
- **Bob is speech-only** — Bob communicates via voice + speech bubble on the 3D avatar. Bob's messages do NOT appear in the chat panel. Do not add assistant message persistence to Supabase or re-add AI messages to the chat UI.
- Streamer character is **Bob** — do not rename without explicit instruction
