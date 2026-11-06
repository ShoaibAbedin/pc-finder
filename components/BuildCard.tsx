"use client";

import { useState } from "react";
import type { Build, BuildPart, BuildResult } from "@/lib/build/assembler";
import { categoryLabel } from "@/lib/categories";
import { formatPrice } from "@/lib/format";
import { CategoryArt } from "./Art";

const LABELS: Record<Build["label"], string> = { best: "Best build", cheaper: "Cheaper", stretch: "Stretch" };

function PartRow({ p }: { p: BuildPart }) {
  return (
    <li>
      <a href={p.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 py-3 sm:gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-tile p-1.5 sm:size-16">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain mix-blend-multiply" />
          ) : (
            <CategoryArt category={p.category} className="h-4/5 w-4/5 text-fg/70" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{categoryLabel(p.category) ?? p.category}</p>
          <p className="line-clamp-1 text-sm font-medium group-hover:underline">{p.title}</p>
          <p className="text-xs text-muted">
            {p.retailer ?? "—"}
            {p.pickup ? " · Melb pickup" : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold tabular-nums">{formatPrice(p.priceCents)}</div>
          <span className="text-xs text-muted group-hover:text-fg">View →</span>
        </div>
      </a>
    </li>
  );
}

export function BuildCard({ result, prevBestTotal }: { result: BuildResult; prevBestTotal: number | null }) {
  const [label, setLabel] = useState<Build["label"]>("best");
  const build = result.builds.find((b) => b.label === label) ?? result.builds[0];
  if (!build) {
    return (
      <div className="rounded-[28px] bg-surface p-6 text-sm text-muted sm:p-8">
        <p className="display text-3xl text-fg">Your build</p>
        <p className="mt-2">{result.notes.join(". ") || "No complete build fits right now."}</p>
      </div>
    );
  }

  const best = result.builds.find((b) => b.label === "best");
  const left = result.budgetCents - build.totalCents;
  const delta = label === "best" && best && prevBestTotal ? best.totalCents - prevBestTotal : 0;
  const setupTotal = build.totalCents + result.extrasTotalCents;

  return (
    <div className="overflow-hidden rounded-[28px] bg-surface">
      <div className="flex flex-wrap items-end justify-between gap-4 bg-fg px-6 py-6 text-bg sm:px-8 sm:py-8">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bg/60">Complete compatible build · in stock now</p>
          <p className="display mt-2 text-5xl tabular-nums sm:text-6xl">{formatPrice(build.totalCents)}</p>
          <p className="mt-1 text-sm text-bg/70">
            {left >= 0 ? `${formatPrice(left)} under` : `${formatPrice(-left)} over`} your {formatPrice(result.budgetCents)} build budget
            {delta !== 0 && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${delta < 0 ? "bg-good text-white" : "bg-bg/15"}`}>
                {delta < 0 ? "▼" : "▲"} {formatPrice(Math.abs(delta))} since last update
              </span>
            )}
          </p>
        </div>
        {result.builds.length > 1 && (
          <div className="flex gap-2" role="tablist" aria-label="Build options">
            {result.builds.map((b) => (
              <button
                key={b.label}
                type="button"
                role="tab"
                aria-selected={b.label === label}
                onClick={() => setLabel(b.label)}
                className={`btn btn-sm ${b.label === label ? "bg-bg text-fg" : "border border-bg/25 text-bg hover:border-bg"}`}
              >
                {LABELS[b.label]}
                {best && b.label !== "best" && (
                  <span className="opacity-70">
                    {b.totalCents < best.totalCents ? "−" : "+"}
                    {formatPrice(Math.abs(b.totalCents - best.totalCents))}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-8 px-6 py-4 sm:px-8 sm:py-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <ul className="divide-y divide-border">
            {build.parts.map((p) => (
              <PartRow key={p.key} p={p} />
            ))}
          </ul>
          {build.owned.length > 0 && (
            <p className="mt-2 text-xs text-muted">Using your own: {build.owned.map((c) => categoryLabel(c) ?? c).join(", ")}</p>
          )}
          {result.extras.length > 0 && (
            <>
              <p className="eyebrow mt-6">Also for your setup</p>
              <ul className="divide-y divide-border">
                {result.extras.map((p) => (
                  <PartRow key={p.key} p={p} />
                ))}
              </ul>
              <p className="mt-2 text-sm">
                Setup total <span className="font-semibold tabular-nums">{formatPrice(setupTotal)}</span>
                <span className="text-muted"> of your {formatPrice(result.budgetCents + result.extrasTotalCents)} budget</span>
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-muted-bg p-5">
            <p className="eyebrow">Compatibility checked</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {build.checks.map((c) => (
                <li key={c} className="flex gap-2">
                  <span className="text-good" aria-hidden>
                    ✓
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
          {result.prebuilt && best && (
            <a href={result.prebuilt.part.url} target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-border p-5 hover:border-fg">
              <p className="eyebrow">Best prebuilt in your budget</p>
              <p className="mt-2 line-clamp-2 text-sm font-medium group-hover:underline">{result.prebuilt.part.title}</p>
              <p className="mt-1 text-sm">
                <span className="font-semibold">{formatPrice(result.prebuilt.part.priceCents)}</span>{" "}
                <span className="text-muted">
                  ·{" "}
                  {result.prebuilt.diffCents < 0
                    ? `${formatPrice(-result.prebuilt.diffCents)} less than building — compare the parts before buying`
                    : `${formatPrice(result.prebuilt.diffCents)} more than building it yourself`}
                </span>
              </p>
            </a>
          )}
          <p className="text-xs text-muted">
            Prices are from each store&apos;s listing at the last update. Builds use in-stock parts only and refresh with every
            update.
          </p>
        </div>
      </div>
    </div>
  );
}
