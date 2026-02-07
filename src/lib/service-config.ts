/**
 * Service configuration fetched from Supabase `config` table.
 * Cached in memory with a 30-second TTL to avoid hitting the DB
 * on every chat flush or proactive speech tick.
 *
 * Uses the plain Supabase client (not the SSR one) because this
 * runs from setInterval callbacks outside any request context.
 */
import { getSupabase } from "@/lib/supabase";

const CACHE_TTL_MS = 30_000;

let cachedValue = false;
let cachedAt = 0;

/**
 * Returns `true` when the service is in shutdown/maintenance mode.
 * Fail-open: returns `false` if the query fails so a DB blip
 * doesn't accidentally kill the stream.
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

    const { data, error } = await supabase
      .from("config")
      .select("is_shutdown")
      .eq("id", "default")
      .single();

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
