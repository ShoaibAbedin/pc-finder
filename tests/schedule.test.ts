import { describe, expect, it } from "vitest";
import { blackFridayWindow, decideRefresh, effectiveIntervalHours, isStale, parseIntervalHours, shouldRunUpdate, type WorkflowRunInfo } from "../lib/schedule";

const at = (h: number) => new Date(Date.UTC(2026, 10, 6, 0, 0) + h * 3_600_000);

describe("shouldRunUpdate", () => {
  it("runs when there has never been an update", () => {
    expect(shouldRunUpdate({ lastSuccessStart: null, intervalHours: 10, now: at(0) }).run).toBe(true);
  });
  it("waits until the interval (minus 1 h tolerance for the 2-hourly check) has passed", () => {
    expect(shouldRunUpdate({ lastSuccessStart: at(0), intervalHours: 10, now: at(8) }).run).toBe(false);
    expect(shouldRunUpdate({ lastSuccessStart: at(0), intervalHours: 10, now: at(9.5) }).run).toBe(true);
  });
  it("a 10 h interval doesn't drift to 12 h with 2-hourly checks", () => {
    const last = at(5 / 60); // checks at 02:17, 04:17 ... 10:17 — the 10:17 check must run
    expect(shouldRunUpdate({ lastSuccessStart: last, intervalHours: 10, now: at(10 + 17 / 60) }).run).toBe(true);
    expect(shouldRunUpdate({ lastSuccessStart: last, intervalHours: 10, now: at(8 + 17 / 60) }).run).toBe(false);
  });
  it("supports faster intervals (Black Friday week)", () => {
    expect(shouldRunUpdate({ lastSuccessStart: at(0), intervalHours: 4, now: at(3.5) }).run).toBe(true);
  });
  it("force always runs", () => {
    expect(shouldRunUpdate({ lastSuccessStart: at(0), intervalHours: 10, now: at(0.1), force: true })).toEqual({ run: true, reason: "manual refresh" });
  });
  it("parses the interval safely", () => {
    expect(parseIntervalHours("4")).toBe(4);
    expect(parseIntervalHours(undefined)).toBe(10);
    expect(parseIntervalHours("0")).toBe(10);
    expect(parseIntervalHours("abc")).toBe(10);
  });
});

describe("decideRefresh", () => {
  const run = (o: Partial<WorkflowRunInfo>): WorkflowRunInfo => ({ status: "completed", conclusion: "success", createdAt: at(0).toISOString(), url: "", ...o });
  it("blocks while a run is in progress or queued", () => {
    expect(decideRefresh(run({ status: "in_progress" }), at(1)).ok).toBe(false);
    expect(decideRefresh(run({ status: "queued" }), at(1)).ok).toBe(false);
  });
  it("enforces a 10 minute cool-down", () => {
    expect(decideRefresh(run({}), new Date(at(0).getTime() + 5 * 60_000))).toMatchObject({ ok: false });
    expect(decideRefresh(run({}), new Date(at(0).getTime() + 11 * 60_000))).toEqual({ ok: true });
  });
  it("allows the first ever refresh", () => expect(decideRefresh(null, at(0))).toEqual({ ok: true }));
});

describe("isStale", () => {
  it("flags data older than 24 h", () => {
    const now = at(30).getTime();
    expect(isStale(at(0).toISOString(), now)).toBe(true);
    expect(isStale(at(10).toISOString(), now)).toBe(false);
    expect(isStale(null, now)).toBe(true);
  });
});

describe("Black Friday window", () => {
  it("2026: Black Friday is 27 Nov; window 24 Nov – 1 Dec (Melbourne)", () => {
    const w = blackFridayWindow(2026);
    expect(w.start.toISOString()).toBe("2026-11-23T13:00:00.000Z"); // 24 Nov 00:00 AEDT
    expect(w.end.toISOString()).toBe("2026-12-01T13:00:00.000Z"); // 2 Dec 00:00 AEDT
  });
  it("switches to the faster interval only inside the window", () => {
    expect(effectiveIntervalHours(12, 8, new Date("2026-11-10T00:00:00Z"))).toEqual({ hours: 12, blackFriday: false });
    expect(effectiveIntervalHours(12, 8, new Date("2026-11-27T00:00:00Z"))).toEqual({ hours: 8, blackFriday: true });
    expect(effectiveIntervalHours(12, 8, new Date("2026-12-03T00:00:00Z"))).toEqual({ hours: 12, blackFriday: false });
  });
  it("finds the right Black Friday in other years", () => {
    expect(blackFridayWindow(2027).start.toISOString().slice(0, 10)).toBe("2027-11-22"); // BF 26 Nov 2027
  });
});
