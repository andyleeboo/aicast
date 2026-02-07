/**
 * Service configuration fetched from Supabase `config` table.
 * Cached in memory with a 30-second TTL to avoid hitting the DB
 * on every chat flush or proactive speech tick.
 *
 * Uses the plain Supabase client (not the SSR one) because this
 * runs from setInterval callbacks outside any request context.
 *
 * Two access modes:
 *  - isShutdownSync() — returns cached value instantly, never blocks.
 *    Use this in latency-sensitive paths (chat flush handler).
 *  - isShutdown() — async, refreshes cache if stale. OK for slower
 *    paths (proactive speech, SSE keepalive).
 */
import { getSupabase } from "@/lib/supabase";

const CACHE_TTL_MS = 30_000;

let cachedValue = false;
let cachedAt = 0;
let refreshing = false;

/** Fire-and-forget cache refresh. Never throws, never blocks callers. */
function refreshCache() {
  if (refreshing) return;
  refreshing = true;

  const supabase = getSupabase();
  if (!supabase) {
    cachedAt = Date.now();
    refreshing = false;
    return;
  }

  Promise.resolve(
    supabase
      .from("config")
      .select("is_shutdown")
      .eq("id", "default")
      .single()
  )
    .then(({ data, error }) => {
      if (error || !data) {
        console.warn("[service-config] Failed to fetch config:", error?.message);
      } else {
        cachedValue = !!data.is_shutdown;
      }
      cachedAt = Date.now();
    })
    .catch((err) => {
      console.warn("[service-config] Unexpected error:", err);
      cachedAt = Date.now();
    })
    .finally(() => {
      refreshing = false;
    });
}

/**
 * Non-blocking: returns the cached shutdown flag instantly.
 * Triggers a background refresh if the cache is stale.
 * Safe to call in hot paths — never makes the caller wait.
 */
export function isShutdownSync(): boolean {
  if (Date.now() - cachedAt >= CACHE_TTL_MS) {
    refreshCache();
  }
  return cachedValue;
}

/**
 * Async version: refreshes cache if stale, then returns the value.
 * Has a 3-second timeout so it can't hang the caller forever.
 * Fail-open: returns `false` on error.
 */
export async function isShutdown(): Promise<boolean> {
  const now = Date.now();
  if (now - cachedAt < CACHE_TTL_MS) return cachedValue;

  try {
    const supabase = getSupabase();
    if (!supabase) {
      cachedAt = now;
      return cachedValue;
    }

    // Race against a 3s timeout to prevent hanging
    const { data, error } = await Promise.race([
      Promise.resolve(
        supabase
          .from("config")
          .select("is_shutdown")
          .eq("id", "default")
          .single()
      ),
      new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: "timeout" } }), 3_000)
      ),
    ]);

    if (error || !data) {
      console.warn("[service-config] Failed to fetch config:", error?.message);
      cachedAt = now;
      return cachedValue;
    }

    cachedValue = !!data.is_shutdown;
    cachedAt = now;
    return cachedValue;
  } catch (err) {
    console.warn("[service-config] Unexpected error:", err);
    cachedAt = now;
    return cachedValue;
  }
}
