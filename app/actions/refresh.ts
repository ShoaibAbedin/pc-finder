"use server";

import { revalidatePath } from "next/cache";
import { dispatchUpdate, latestWorkflowRun } from "@/lib/github";
import { decideRefresh, isRunActive } from "@/lib/schedule";

export interface RefreshState {
  running: boolean;
  message?: string;
  error?: string;
  finishedOk?: boolean;
  startedAt?: string;
}

/** Starts an update via GitHub Actions (protected by the site lock like every other request). */
export async function startRefresh(): Promise<RefreshState> {
  try {
    const latest = await latestWorkflowRun();
    const d = decideRefresh(latest, new Date());
    if (!d.ok) return { running: isRunActive(latest), message: d.reason, startedAt: latest?.createdAt };
    await dispatchUpdate();
    return { running: true, message: "Update started — usually takes 3–8 minutes.", startedAt: new Date().toISOString() };
  } catch (err) {
    return { running: false, error: (err as Error).message };
  }
}

export async function refreshStatus(): Promise<RefreshState> {
  try {
    const latest = await latestWorkflowRun();
    if (!latest) return { running: false };
    if (isRunActive(latest)) return { running: true, startedAt: latest.createdAt };
    revalidatePath("/", "layout");
    return { running: false, finishedOk: latest.conclusion === "success", startedAt: latest.createdAt };
  } catch (err) {
    return { running: false, error: (err as Error).message };
  }
}
