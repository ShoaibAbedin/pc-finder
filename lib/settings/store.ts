import type { SupabaseClient } from "@supabase/supabase-js";
import { SettingsSchema, type Settings } from "./schema";

export async function loadSettings(db: SupabaseClient): Promise<Settings | null> {
  const { data, error } = await db.from("app_settings").select("data").eq("id", 1).maybeSingle();
  if (error) throw new Error(`loadSettings: ${error.message}`);
  if (!data) return null;
  const parsed = SettingsSchema.safeParse(data.data);
  return parsed.success ? parsed.data : null;
}

export async function saveSettings(db: SupabaseClient, s: Settings): Promise<void> {
  const { error } = await db
    .from("app_settings")
    .upsert({ id: 1, data: s, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(`saveSettings: ${error.message}`);
}
