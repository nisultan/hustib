"use client";

import { SupabaseClient, createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * The browser Supabase client, created once and reused.
 *
 * Returns null when the environment variables are absent, which is the normal
 * state for the local-first build — every caller treats null as "no backend
 * configured" and falls back to localStorage rather than throwing. That means
 * the app runs with no Supabase project at all, and starts talking to one the
 * moment the keys appear in .env.local.
 */
let cached: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  cached ??= createClient<Database>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
