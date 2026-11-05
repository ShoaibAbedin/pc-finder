import "server-only";
import type { WorkflowRunInfo } from "./schedule";

/**
 * Minimal GitHub Actions client for the Refresh button.
 * Needs GITHUB_TOKEN: a fine-grained token limited to this repo with "Actions: Read and write".
 */
const REPO = process.env.GITHUB_REPO || "ShoaibAbedin/pc-finder";
const WORKFLOW = process.env.GITHUB_WORKFLOW_FILE || "update.yml";
const API = "https://api.github.com";

function headers() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Refresh isn't set up yet (missing GITHUB_TOKEN).");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "pc-finder",
  };
}

export async function latestWorkflowRun(): Promise<WorkflowRunInfo | null> {
  const res = await fetch(`${API}/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=1`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub: HTTP ${res.status}`);
  const run = (await res.json()).workflow_runs?.[0];
  return run ? { status: run.status, conclusion: run.conclusion, createdAt: run.created_at, url: run.html_url } : null;
}

export async function dispatchUpdate(): Promise<void> {
  const res = await fetch(`${API}/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs: { force: true } }),
    cache: "no-store",
  });
  if (res.status !== 204) throw new Error(`GitHub dispatch failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}
