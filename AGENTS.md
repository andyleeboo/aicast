# Repository Guidelines

## Project Structure & Module Organization
AICast is a Next.js 16 App Router project. Routes, layouts, and server actions live in `src/app` (API handlers under `src/app/api`). Shared UI primitives live in `src/components`, hooks in `src/hooks`, while `src/lib` holds Supabase, Gemini, and SSE helpers. Avatar controls, batching, and remote control logic sit in `src/utils` and `src/proxy.ts`. Static fonts/audio/icons belong in `public/`. Root-level `instrumentation*.ts` files configure Sentry for server, edge, and client environments.

## Build, Test, and Development Commands
Install once with `bun install`. Use `bun dev` (Turbopack) for local work, `bun run build` + `bun run start` to simulate Vercel, and `bun lint` to run ESLint with the repo config. When debugging edge-specific issues, run `NEXT_RUNTIME=experimental-edge bun dev` so server actions match production.

## Coding Style & Naming Conventions
Codebase is TypeScript-first with strict checks, so type exported helpers and API payloads explicitly. React components are functional, live in `.tsx`, and use PascalCase filenames; hooks are camelCase prefixed with `use`. Utilities use descriptive kebab-case names. Components use 2-space indentation, Tailwind classes ordered layout→spacing→color, and prefer React Server Components unless interactivity demands `"use client"`. Run `bun lint --fix` before every commit; no Prettier is configured.

## Testing Guidelines
There is no automated suite yet. For regression checks, open two tabs against `bun dev`, send chat, try `/spin`, `/hangman`, and confirm SSE updates plus speech-bubble sync. New tests should colocate beside the module as `<name>.test.ts` using Vitest or Jest (add a `bun test` script). Name tests after the unit under behavior, e.g., `processChatBatch batches donations first`. Document manual QA steps in your PR until CI coverage exists.

## Commit & Pull Request Guidelines
Commits follow the short imperative style already in history (`Fix viewer count showing 0`). Keep diffs focused and mention Supabase schema or env var changes in the body. Pull requests should include: summary, screenshots or clips for UI/3D changes, reproduction/verification steps, and linked issues if applicable. Always run `bun lint` and the relevant manual tests before requesting review.

## Security & Configuration Tips
Secrets live in `.env.local`; mirror the keys listed in `README.md` but never commit them. Use project-specific Gemini and Supabase credentials, and rotate them after public demos. When editing telemetry or auth logic, update the matching `sentry.*.config.ts` or `instrumentation.ts` file so server, client, and edge bundles remain consistent. Treat `/api/avatar/actions` as privileged—add authentication or signing before exposing new agent controls.
