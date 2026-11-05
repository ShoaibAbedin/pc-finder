"use server";

import { revalidatePath } from "next/cache";
import { providersFromEnv } from "@/lib/ai/client";
import { createServiceClient } from "@/lib/db/client";
import { runRanking } from "@/lib/ranking/run";
import { SettingsSchema } from "@/lib/settings/schema";
import { saveSettings } from "@/lib/settings/store";

export interface SaveResult {
  ok: boolean;
  error?: string;
  message?: string;
}

export async function saveSettingsAction(input: unknown): Promise<SaveResult> {
  const parsed = SettingsSchema.safeParse(input);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: `${i?.path.join(" → ")}: ${i?.message}` };
  }
  const db = createServiceClient();
  try {
    await saveSettings(db, parsed.data);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  // Re-rank immediately so For You reflects the new settings.
  try {
    const logs: string[] = [];
    const r = await runRanking(db, { providers: providersFromEnv(), db, log: (m) => logs.push(m) });
    console.log(logs.join("\n"));
    revalidatePath("/", "layout");
    const via =
      r.targetsSource === "fallback" ? " (AI unavailable — used default targets; will retry next update)" : "";
    return { ok: true, message: `Saved. Ranked ${r.scored ?? 0} deals for you${via}.` };
  } catch (err) {
    console.error(err);
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved. Ranking will update on the next refresh." };
  }
}
