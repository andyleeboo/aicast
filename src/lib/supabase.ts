import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let _client: SupabaseClient<Database> | undefined;

export function getSupabase(): SupabaseClient<Database> | null {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    if (!url || !key) {
      return null;
    }
    _client = createClient<Database>(url, key);
  }
  return _client;
}
