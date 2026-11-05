"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SaveResult } from "@/app/settings/actions";
import { CATEGORY_TABS } from "@/lib/categories";
import { BUILD_CATEGORIES } from "@/lib/settings/constants";
import type { Settings } from "@/lib/settings/schema";

const input = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-fg";
const label = "mb-1.5 block text-sm font-medium";
const catLabel = (slug: string) => CATEGORY_TABS.find((c) => c.slug === slug)?.label ?? slug;

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm has-[:checked]:border-fg">
      <input type="checkbox" className="size-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((o) => (
        <button
          type="button"
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-lg border px-3 py-2.5 text-left text-sm ${value === o.v ? "border-fg bg-muted-bg" : "border-border"}`}
        >
          <div className="font-medium">{o.label}</div>
          {o.hint && <div className="text-xs text-muted">{o.hint}</div>}
        </button>
      ))}
    </div>
  );
}

type Step = { title: string; render: () => React.ReactNode };

export function SettingsForm({
  initial,
  wizard,
  save,
}: {
  initial: Settings;
  wizard?: boolean;
  save: (s: unknown) => Promise<SaveResult>;
}) {
  const [s, setS] = useState<Settings>(initial);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const set = <K extends keyof Settings>(k: K, v: Partial<Settings[K]>) =>
    setS((prev) => ({ ...prev, [k]: typeof v === "object" && !Array.isArray(v) ? { ...(prev[k] as object), ...v } : v }));

  const steps: Step[] = [
    {
      title: "Budget",
      render: () => (
        <div className="flex flex-col gap-5">
          <div>
            <label className={label} htmlFor="total">
              Total budget (AUD)
            </label>
            <input
              id="total"
              inputMode="numeric"
              className={input}
              value={s.budget.total || ""}
              onChange={(e) => set("budget", { total: Number(e.target.value.replace(/\D/g, "")) || 0 })}
            />
          </div>
          <div>
            <span className={label}>Build my own or prebuilt?</span>
            <Choice
              value={s.mode}
              onChange={(mode) => setS({ ...s, mode })}
              options={[
                { v: "build", label: "Build my own", hint: "Individual parts" },
                { v: "prebuilt", label: "Prebuilt", hint: "Ready-made PCs" },
                { v: "both", label: "Show both", hint: "Compare them" },
              ]}
            />
          </div>
          <details className="rounded-lg border border-border">
            <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium">
              Optional: limits per category ▾
            </summary>
            <div className="grid grid-cols-2 gap-3 border-t border-border p-3 sm:grid-cols-3">
              {(["gpu", "cpu", "motherboard", "ram", "storage", "psu", "case", "cooling", "prebuilt", "monitor", "peripheral", "software"] as const).map(
                (c) => (
                  <div key={c}>
                    <label className="mb-1 block text-xs text-muted" htmlFor={`lim-${c}`}>
                      {catLabel(c)}
                    </label>
                    <input
                      id={`lim-${c}`}
                      inputMode="numeric"
                      placeholder="Auto"
                      className={input}
                      value={s.budget.perCategory[c] ?? ""}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/\D/g, "")) || undefined;
                        set("budget", { perCategory: { ...s.budget.perCategory, [c]: n } });
                      }}
                    />
                  </div>
                ),
              )}
            </div>
          </details>
        </div>
      ),
    },
    {
      title: "What it's for",
      render: () => (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Check checked={s.uses.gaming} onChange={(v) => set("uses", { gaming: v })}>Gaming</Check>
            <Check checked={s.uses.dev} onChange={(v) => set("uses", { dev: v })}>Programming / dev work</Check>
            <Check checked={s.uses.editing} onChange={(v) => set("uses", { editing: v })}>Video / photo editing</Check>
            <Check checked={s.uses.streaming} onChange={(v) => set("uses", { streaming: v })}>Streaming</Check>
            <Check checked={s.uses.ai} onChange={(v) => set("uses", { ai: v })}>Local AI / machine learning</Check>
            <Check checked={s.uses.office} onChange={(v) => set("uses", { office: v })}>Office / everyday</Check>
          </div>
          {s.uses.gaming && (
            <>
              <div>
                <span className={label}>Gaming resolution</span>
                <Choice
                  value={s.uses.resolution}
                  onChange={(resolution) => set("uses", { resolution })}
                  options={[
                    { v: "1080p", label: "1080p" },
                    { v: "1440p", label: "1440p" },
                    { v: "4k", label: "4K" },
                    { v: "ultrawide", label: "Ultrawide" },
                  ]}
                />
              </div>
              <div>
                <span className={label}>Priority</span>
                <Choice
                  value={s.uses.gamingStyle}
                  onChange={(gamingStyle) => set("uses", { gamingStyle })}
                  options={[
                    { v: "competitive", label: "High FPS", hint: "Competitive shooters" },
                    { v: "balanced", label: "Balanced" },
                    { v: "max-settings", label: "Max settings", hint: "Eye candy" },
                  ]}
                />
              </div>
            </>
          )}
          <div>
            <label className={label} htmlFor="unotes">
              Anything else? <span className="font-normal text-muted">(optional)</span>
            </label>
            <input id="unotes" className={input} placeholder="e.g. Cyberpunk, Blender, Docker" value={s.uses.notes} onChange={(e) => set("uses", { notes: e.target.value })} />
          </div>
        </div>
      ),
    },
    {
      title: "Requirements",
      render: () => (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="pb">Preferred brands</label>
              <input id="pb" className={input} placeholder="e.g. ASUS, Corsair" value={s.requirements.preferredBrands.join(", ")} onChange={(e) => set("requirements", { preferredBrands: e.target.value.split(",").map((x) => x.trimStart()) })} />
            </div>
            <div>
              <label className={label} htmlFor="ab">Brands to avoid</label>
              <input id="ab" className={input} placeholder="e.g. Gigabyte" value={s.requirements.avoidBrands.join(", ")} onChange={(e) => set("requirements", { avoidBrands: e.target.value.split(",").map((x) => x.trimStart()) })} />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="mh">Must-have parts or features</label>
            <input id="mh" className={input} placeholder="e.g. 32GB RAM, 2TB SSD, AMD CPU" value={s.requirements.mustHave} onChange={(e) => set("requirements", { mustHave: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={label} htmlFor="size">Size</label>
              <select id="size" className={input} value={s.requirements.size} onChange={(e) => set("requirements", { size: e.target.value as Settings["requirements"]["size"] })}>
                <option value="any">Any</option>
                <option value="full">Full tower</option>
                <option value="mid">Mid tower</option>
                <option value="compact">Compact (mATX)</option>
                <option value="sff">Small form factor (ITX)</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="colour">Colour</label>
              <select id="colour" className={input} value={s.requirements.colour} onChange={(e) => set("requirements", { colour: e.target.value as Settings["requirements"]["colour"] })}>
                <option value="any">Any</option>
                <option value="black">Black</option>
                <option value="white">White</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="rgb">RGB lighting</label>
              <select id="rgb" className={input} value={s.requirements.rgb} onChange={(e) => set("requirements", { rgb: e.target.value as Settings["requirements"]["rgb"] })}>
                <option value="any">Don&apos;t mind</option>
                <option value="yes">Yes please</option>
                <option value="no">No RGB</option>
              </select>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Check checked={s.requirements.quiet} onChange={(v) => set("requirements", { quiet: v })}>Quiet</Check>
            <Check checked={s.requirements.wifi} onChange={(v) => set("requirements", { wifi: v })}>Built-in Wi-Fi</Check>
          </div>
        </div>
      ),
    },
    {
      title: "Parts you own",
      render: () => (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">Tick anything you&apos;re reusing — those categories won&apos;t be recommended.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BUILD_CATEGORIES.map((c) => (
              <Check
                key={c}
                checked={s.owned.categories.includes(c)}
                onChange={(v) =>
                  set("owned", { categories: v ? [...s.owned.categories, c] : s.owned.categories.filter((x) => x !== c) })
                }
              >
                {catLabel(c)}
              </Check>
            ))}
          </div>
          <div>
            <label className={label} htmlFor="onotes">Details <span className="font-normal text-muted">(optional)</span></label>
            <input id="onotes" className={input} placeholder="e.g. Corsair RM750x PSU, 2TB Samsung 980" value={s.owned.notes} onChange={(e) => set("owned", { notes: e.target.value })} />
          </div>
        </div>
      ),
    },
    {
      title: "Extras",
      render: () => (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Also find deals on:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Check checked={s.extras.monitor} onChange={(v) => set("extras", { monitor: v })}>Monitor</Check>
            <Check checked={s.extras.keyboard} onChange={(v) => set("extras", { keyboard: v })}>Keyboard</Check>
            <Check checked={s.extras.mouse} onChange={(v) => set("extras", { mouse: v })}>Mouse</Check>
            <Check checked={s.extras.headset} onChange={(v) => set("extras", { headset: v })}>Headset</Check>
            <Check checked={s.extras.windows} onChange={(v) => set("extras", { windows: v })}>Windows licence</Check>
          </div>
        </div>
      ),
    },
    {
      title: "Location",
      render: () => (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="suburb">Suburb</label>
            <input id="suburb" className={input} placeholder="e.g. Clayton" value={s.location.suburb} onChange={(e) => set("location", { suburb: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="pc">Postcode</label>
            <input id="pc" inputMode="numeric" maxLength={4} className={input} placeholder="e.g. 3168" value={s.location.postcode} onChange={(e) => set("location", { postcode: e.target.value.replace(/\D/g, "") })} />
          </div>
          <p className="text-xs text-muted sm:col-span-2">Used to boost retailers with Melbourne click &amp; collect.</p>
        </div>
      ),
    },
  ];

  const submit = () => {
    setResult(null);
    startTransition(async () => {
      const clean: Settings = {
        ...s,
        requirements: {
          ...s.requirements,
          preferredBrands: s.requirements.preferredBrands.map((b) => b.trim()).filter(Boolean),
          avoidBrands: s.requirements.avoidBrands.map((b) => b.trim()).filter(Boolean),
        },
      };
      const r = await save(clean);
      setResult(r);
      if (r.ok && wizard) router.push("/");
      else if (r.ok) router.refresh();
    });
  };

  const saveBar = (
    <div className="flex flex-col gap-2">
      {result && (
        <p className={`text-sm ${result.ok ? "text-good" : "text-red-600"}`} role="status">
          {result.ok ? result.message : result.error}
        </p>
      )}
      {pending && <p className="text-sm text-muted">Saving and re-ranking deals for you — this can take up to a minute…</p>}
    </div>
  );

  if (wizard) {
    const cur = steps[step]!;
    const last = step === steps.length - 1;
    return (
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-xs text-muted">
            Step {step + 1} of {steps.length}
          </p>
          <div className="mt-2 h-1 rounded-full bg-muted-bg">
            <div className="h-1 rounded-full bg-fg transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
          <h2 className="mt-4 text-lg font-semibold">{cur.title}</h2>
        </div>
        {cur.render()}
        {saveBar}
        <div className="flex gap-2">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="rounded-lg border border-border px-4 py-2 text-sm">
              Back
            </button>
          )}
          <button
            type="button"
            disabled={pending || (step === 0 && s.budget.total < 200)}
            onClick={() => (last ? submit() : setStep(step + 1))}
            className="ml-auto rounded-lg bg-fg px-5 py-2 text-sm font-medium text-bg disabled:opacity-40"
          >
            {last ? (pending ? "Saving…" : "Finish") : "Next"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {steps.map((st) => (
        <section key={st.title}>
          <h2 className="mb-3 text-base font-semibold">{st.title}</h2>
          {st.render()}
        </section>
      ))}
      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0">
        {saveBar}
        <button
          type="button"
          onClick={submit}
          disabled={pending || s.budget.total < 200}
          className="rounded-lg bg-fg px-5 py-2.5 text-sm font-medium text-bg disabled:opacity-40 sm:self-end"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
