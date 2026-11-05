import type { Candidate } from "./score";

/**
 * AI job 3 (second half): compare a prebuilt's price against buying equivalent parts.
 * The AI only supplies the prebuilt's component list (via spec parsing).
 * Every price here comes from scraped, in-stock listings.
 */

export const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .replace(/nvidia|geforce|amd|radeon|intel|core|processor|graphics|card/g, "")
    .replace(/[^a-z0-9]/g, "");

export interface PartIndex {
  gpu: Map<string, number>;
  cpu: Map<string, { cents: number; socket: string | null }>;
  ramByGb: Map<number, number>;
  storage: { gb: number; cents: number }[];
  psu: { w: number; cents: number }[];
  boardBySocket: Map<string, number>;
  caseCents: number | null;
  coolerCents: number | null;
  windowsCents: number | null;
}

function minInto<K>(m: Map<K, number>, k: K, v: number) {
  const cur = m.get(k);
  if (cur === undefined || v < cur) m.set(k, v);
}

export function buildPartIndex(cands: Candidate[]): PartIndex {
  const idx: PartIndex = {
    gpu: new Map(),
    cpu: new Map(),
    ramByGb: new Map(),
    storage: [],
    psu: [],
    boardBySocket: new Map(),
    caseCents: null,
    coolerCents: null,
    windowsCents: null,
  };
  const cases: number[] = [];
  const coolers: number[] = [];
  for (const c of cands) {
    const sp = c.specs;
    const p = c.priceCents;
    if (c.source !== "product" || !sp || !p || c.status !== "active" || sp.relevant === false) continue;
    switch (c.category) {
      case "gpu":
        if (sp.gpu_chip || sp.model) minInto(idx.gpu, norm(sp.gpu_chip ?? sp.model), p);
        break;
      case "cpu": {
        const k = norm(sp.cpu_model ?? sp.model);
        const cur = idx.cpu.get(k);
        if (k && (!cur || p < cur.cents)) idx.cpu.set(k, { cents: p, socket: sp.socket });
        break;
      }
      case "ram":
        if (sp.capacity_gb && !/so-?dimm|laptop/i.test(c.title)) minInto(idx.ramByGb, sp.capacity_gb, p);
        break;
      case "storage":
        if (sp.capacity_gb && sp.storage_type && /nvme|ssd/i.test(sp.storage_type)) idx.storage.push({ gb: sp.capacity_gb, cents: p });
        break;
      case "psu":
        if (sp.wattage) idx.psu.push({ w: sp.wattage, cents: p });
        break;
      case "motherboard":
        if (sp.socket) minInto(idx.boardBySocket, sp.socket.toUpperCase(), p);
        break;
      case "case":
        if ((sp.tier ?? 0) >= 3) cases.push(p);
        break;
      case "cooling":
        if (/air/i.test(sp.cooler_type ?? "") && (sp.tier ?? 0) >= 3) coolers.push(p);
        break;
      case "software":
        if (/windows/i.test(c.title) && (idx.windowsCents === null || p < idx.windowsCents)) idx.windowsCents = p;
        break;
    }
  }
  idx.caseCents = cases.length ? Math.min(...cases) : null;
  idx.coolerCents = coolers.length ? Math.min(...coolers) : null;
  return idx;
}

const cheapestAtLeast = (arr: { cents: number }[], ok: (x: any) => boolean) =>
  arr.filter(ok).reduce<number | null>((m, x) => (m === null || x.cents < m ? x.cents : m), null);

/** Returns the parts total in cents, or null if the key parts (CPU+GPU) can't be matched. */
export function partsTotalFor(pb: Candidate, idx: PartIndex): { cents: number | null; missing: string[] } {
  const sp = pb.specs;
  const missing: string[] = [];
  if (!sp) return { cents: null, missing: ["specs"] };
  let total = 0;

  const gpu = sp.pb_gpu ? idx.gpu.get(norm(sp.pb_gpu)) : undefined;
  const cpu = sp.pb_cpu ? idx.cpu.get(norm(sp.pb_cpu)) : undefined;
  if (gpu === undefined) missing.push("gpu");
  if (!cpu) missing.push("cpu");
  if (gpu === undefined || !cpu) return { cents: null, missing };
  total += gpu + cpu.cents;

  const board = cpu.socket ? idx.boardBySocket.get(cpu.socket.toUpperCase()) : undefined;
  board !== undefined ? (total += board) : missing.push("motherboard");

  const ram = sp.pb_ram_gb ? idx.ramByGb.get(sp.pb_ram_gb) : undefined;
  ram !== undefined ? (total += ram) : missing.push("ram");

  const gb = sp.pb_storage_gb ?? 1000;
  const storage = cheapestAtLeast(idx.storage, (x) => x.gb >= gb && x.gb <= gb * 2);
  storage !== null ? (total += storage) : missing.push("storage");

  const w = sp.pb_psu_w ?? 650;
  const psu = cheapestAtLeast(idx.psu, (x) => x.w >= w && x.w <= w + 250);
  psu !== null ? (total += psu) : missing.push("psu");

  idx.caseCents !== null ? (total += idx.caseCents) : missing.push("case");
  idx.coolerCents !== null ? (total += idx.coolerCents) : missing.push("cooling");
  if (/windows/i.test(sp.pb_os ?? "")) idx.windowsCents !== null ? (total += idx.windowsCents) : missing.push("windows");

  // Too many guesses → not a fair comparison.
  if (missing.length > 2) return { cents: null, missing };
  return { cents: total, missing };
}
