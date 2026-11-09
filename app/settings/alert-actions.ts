"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendPush } from "@/lib/alerts/notify";
import { loadAlertSettings } from "@/lib/alerts/run";
import { createServiceClient } from "@/lib/db/client";

type Result = { ok: boolean; message: string };

const OptionsSchema = z.object({
  notify_build: z.boolean(),
  build_drop_dollars: z.coerce.number().int().min(1).max(5000),
  notify_top_picks: z.boolean(),
  top_pick_drop_pct: z.coerce.number().int().min(1).max(90),
});

export async function saveAlertOptions(input: unknown): Promise<Result> {
  const p = OptionsSchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Invalid options" };
  const { error } = await createServiceClient()
    .from("alert_settings")
    .update({
      notify_build: p.data.notify_build,
      build_drop_cents: p.data.build_drop_dollars * 100,
      notify_top_picks: p.data.notify_top_picks,
      top_pick_drop_pct: p.data.top_pick_drop_pct,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  revalidatePath("/settings");
  return error ? { ok: false, message: error.message } : { ok: true, message: "Alert options saved." };
}

const WatchSchema = z.object({
  query: z.string().trim().min(2, "Type what to watch for, e.g. RTX 5070").max(80),
  category: z.string().max(20).optional().transform((v) => (v ? v : null)),
  max_dollars: z.coerce.number().int().min(1, "Set a maximum price").max(50000),
});

export async function addWatch(input: unknown): Promise<Result> {
  const p = WatchSchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Invalid watch" };
  const { error } = await createServiceClient()
    .from("alert_watches")
    .insert({ query: p.data.query, category: p.data.category, max_price_cents: p.data.max_dollars * 100 });
  revalidatePath("/settings");
  return error ? { ok: false, message: error.message } : { ok: true, message: `Watching "${p.data.query}" under $${p.data.max_dollars}.` };
}

export async function deleteWatch(id: number): Promise<Result> {
  const { error } = await createServiceClient().from("alert_watches").delete().eq("id", id);
  revalidatePath("/settings");
  return error ? { ok: false, message: error.message } : { ok: true, message: "Watch removed." };
}

export async function sendTestAlert(): Promise<Result> {
  const s = await loadAlertSettings(createServiceClient());
  if (!s) return { ok: false, message: "Alerts aren't set up yet." };
  try {
    await sendPush(s.ntfy_topic, {
      title: "PC Finder test alert",
      message: "Alerts are working. You'll get a notification like this when a deal you care about drops.",
      tags: ["white_check_mark"],
    });
    return { ok: true, message: "Test sent — check your phone." };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
