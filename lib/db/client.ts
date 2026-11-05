import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Loads .env.local (if present) into process.env. Safe to call more than once. */
export function loadEnv() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* no .env.local — rely on real env vars (e.g. GitHub Actions secrets) */
  }
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.includes("YOUR-")) throw new Error(`Missing env var ${name} — set it in .env.local`);
  return v;
}

/** Server-only client using the service-role key. Never import this from browser code. */
export function createServiceClient(): SupabaseClient {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
