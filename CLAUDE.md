# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is AICast

AI live streaming platform (Twitch for AI). Viewers watch AI-generated broadcasts and chat with AI streamers in real time. Currently in early development with a single hardcoded channel ("Late Night AI" hosted by "Bob"). Built for the **Gemini 3 Hackathon** on Devpost (deadline Feb 10, 2026).

## Commands

```bash
yarn dev          # Start dev server at localhost:3000
yarn build        # Production build
yarn lint         # ESLint (flat config, eslint.config.mjs)
```

Both `yarn.lock` and `bun.lock` exist; use yarn as the primary package manager.

## Environment Variables

- `GEMINI_API_KEY` — Google AI Studio API key (required for AI chat; without it, the Gemini client lazy-inits with an empty key)

## Tech Stack

- **Next.js 16** (App Router) + TypeScript (strict mode)
- **Tailwind CSS v4** (using `@import "tailwindcss"` in globals.css, not v3 `@tailwind` directives)
- **React Three Fiber + Three.js** for the 3D avatar
- **Google Gemini 3** (`@google/genai`, model: `gemini-3-flash-preview`) for AI chat responses
- Path alias: `@/*` maps to `./src/*`

## Architecture

### Page Structure

- `/` — Landing page with hero CTA linking to the single live channel
- `/live/[id]` — Stream viewer page: 3D avatar + chat panel side by side

### Data Flow: Chat → Avatar Animation

1. User types in `ChatPanel` → POST to `/api/chat` with message + history
2. Server appends `buildActionSystemPrompt()` to the streamer's personality, calls Gemini
3. Gemini response starts with `[GESTURE_TAG] [EMOTE_TAG] text...` — server parses and strips tags
4. Response returns `{ response, gesture, emote }` to client
5. `BroadcastContent` (client orchestrator) receives gesture/emote, passes to `AvatarCanvas` → `HeadScene` → `FaceController`

Chat uses a **batch system**: messages are collected for ~3 seconds client-side, then sent as a single batch to the API. The AI sees "who said what" and responds like a real streamer scanning chat. Users pick a display name before chatting.

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

Then work inside `.worktrees/<name>/` — it's a full checkout with its own `node_modules` (run `yarn install` after creating).

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
- Run `yarn install` inside each new worktree (they don't share `node_modules`)

## Conventions

- All client components are explicitly marked with `"use client"`
- Three.js objects are pre-allocated at module scope to avoid GC pressure (see `face-controller.ts`)
- Emote commands use a cooldown/lock pattern in `BroadcastContent` to prevent spam
- Chat slash commands (`/wink`, `/blink`, `/sleep`, `/wake`) are handled client-side in `ChatPanel`

## Rules

- **Always use Gemini 3 models** — this project is for the Gemini 3 Hackathon. The model in `src/lib/gemini.ts` must be a `gemini-3-*` model (currently `gemini-3-flash-preview`). Never downgrade to Gemini 2.x or any other model family.
- Streamer character is **Bob** — do not rename without explicit instruction
