/**
 * Original line illustrations for PC Finder. Monochrome strokes (currentColor) with soft surface/tile fills,
 * so they sit naturally on the off-white UI. Fans gently rotate (disabled for reduced-motion users).
 */
type P = { className?: string; title?: string };

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Svg({ viewBox, className, title, children }: P & { viewBox: string; children: React.ReactNode }) {
  return (
    <svg viewBox={viewBox} className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} {...S}>
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

/** A fan: ring + hub + curved blades. `spin` adds the slow rotation. */
function Fan({ cx, cy, r, spin = false, blades = 7 }: { cx: number; cy: number; r: number; spin?: boolean; blades?: number }) {
  const hub = r * 0.28;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className="fill-surface" />
      <g className={spin ? "fan-spin" : undefined}>
        {/* invisible circle makes the group's bounding box centred on the hub, so rotation is exact */}
        <circle cx={cx} cy={cy} r={r * 0.95} stroke="none" fill="none" />
        {Array.from({ length: blades }, (_, i) => (
          <path
            key={i}
            transform={`rotate(${(360 / blades) * i} ${cx} ${cy})`}
            d={`M ${cx} ${cy - hub} C ${cx + r * 0.35} ${cy - r * 0.45}, ${cx + r * 0.2} ${cy - r * 0.85}, ${cx - r * 0.12} ${cy - r * 0.9}`}
            strokeWidth={1.6}
          />
        ))}
      </g>
      <circle cx={cx} cy={cy} r={hub} className="fill-tile" />
    </g>
  );
}

/* ---------------- category art ---------------- */

export function GpuArt(p: P) {
  return (
    <Svg viewBox="0 0 240 150" {...p}>
      <rect x="6" y="28" width="12" height="92" rx="2" className="fill-tile" />
      <path d="M10 40v8M10 60v8M10 80v8M10 100v8" strokeWidth={1.4} />
      <rect x="18" y="34" width="214" height="78" rx="12" className="fill-surface" />
      <path d="M30 46h186" strokeWidth={1.2} opacity={0.35} />
      <Fan cx={82} cy={78} r={27} spin />
      <Fan cx={164} cy={78} r={27} spin />
      <path d="M64 112v10h104v-10" className="fill-tile" />
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d={`M${70 + i * 8} 114v6`} strokeWidth={1.2} />
      ))}
      <rect x="200" y="22" width="20" height="12" rx="2" className="fill-tile" />
    </Svg>
  );
}

export function CpuArt(p: P) {
  const pins = Array.from({ length: 9 }, (_, i) => 52 + i * 12);
  return (
    <Svg viewBox="0 0 200 200" {...p}>
      {pins.map((x) => (
        <g key={x} strokeWidth={1.6}>
          <path d={`M${x} 26v14M${x} 160v14M26 ${x}h14M160 ${x}h14`} />
        </g>
      ))}
      <rect x="40" y="40" width="120" height="120" rx="14" className="fill-surface" />
      <rect x="62" y="62" width="76" height="76" rx="8" className="fill-tile" />
      <path d="M76 92h48M76 104h32" strokeWidth={1.6} />
      <circle cx="52" cy="148" r="3" className="fill-surface" />
    </Svg>
  );
}

export function MotherboardArt(p: P) {
  return (
    <Svg viewBox="0 0 200 200" {...p}>
      <rect x="22" y="18" width="156" height="164" rx="10" className="fill-surface" />
      <rect x="44" y="40" width="50" height="50" rx="6" className="fill-tile" />
      <rect x="56" y="52" width="26" height="26" rx="3" />
      {[112, 124, 136, 148].map((x) => (
        <rect key={x} x={x} y="34" width="6" height="66" rx="2" className="fill-tile" />
      ))}
      <rect x="40" y="118" width="120" height="8" rx="2" className="fill-tile" />
      <rect x="40" y="146" width="90" height="8" rx="2" className="fill-tile" />
      <path d="M94 66h10v-26M40 104h40l8 8M140 140h18M140 152h18" strokeWidth={1.4} />
      <circle cx="160" cy="166" r="6" />
    </Svg>
  );
}

export function RamArt(p: P) {
  return (
    <Svg viewBox="0 0 240 120" {...p}>
      <path d="M12 30 h216 v8 l-8 6 h-200 l-8 -6z" className="fill-tile" />
      <rect x="12" y="38" width="216" height="52" rx="4" className="fill-surface" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={24 + i * 25.5} y="50" width="18" height="24" rx="2" className="fill-tile" />
      ))}
      <path d="M12 90h104m10 0h102" />
      <path d="M116 90v8h10v-8" />
      {Array.from({ length: 26 }, (_, i) => (
        <path key={i} d={`M${18 + i * 8 + (i > 12 ? 10 : 0)} 92v6`} strokeWidth={1.2} />
      ))}
    </Svg>
  );
}

export function StorageArt(p: P) {
  return (
    <Svg viewBox="0 0 240 110" {...p}>
      <path d="M14 38h196a12 12 0 0 1 0 34H14z" className="fill-surface" />
      <circle cx="216" cy="55" r="5" />
      <rect x="40" y="44" width="46" height="22" rx="3" className="fill-tile" />
      <rect x="96" y="44" width="46" height="22" rx="3" className="fill-tile" />
      <rect x="152" y="46" width="28" height="18" rx="3" className="fill-tile" />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M${18 + i * 3.5} 42v26`} strokeWidth={1.1} />
      ))}
      <path d="M40 82h140" strokeWidth={1.2} opacity={0.35} />
    </Svg>
  );
}

export function PsuArt(p: P) {
  return (
    <Svg viewBox="0 0 220 170" {...p}>
      <rect x="18" y="20" width="184" height="130" rx="10" className="fill-surface" />
      <circle cx="96" cy="85" r="50" className="fill-tile" />
      <circle cx="96" cy="85" r="38" strokeWidth={1.4} />
      <circle cx="96" cy="85" r="26" strokeWidth={1.4} />
      <circle cx="96" cy="85" r="14" strokeWidth={1.4} />
      <path d="M46 85h100M96 35v100" strokeWidth={1.4} />
      <rect x="160" y="44" width="26" height="18" rx="3" className="fill-tile" />
      <rect x="164" y="104" width="18" height="24" rx="3" />
      <path d="M170 110v6M176 110v6" strokeWidth={1.4} />
    </Svg>
  );
}

export function CaseArt(p: P) {
  return (
    <Svg viewBox="0 0 160 220" {...p}>
      <rect x="22" y="10" width="116" height="196" rx="10" className="fill-surface" />
      <rect x="34" y="24" width="72" height="168" rx="6" className="fill-tile" />
      <Fan cx={122} cy={58} r={10} blades={5} />
      <Fan cx={122} cy={88} r={10} blades={5} />
      <Fan cx={122} cy={118} r={10} blades={5} />
      <rect x="42" y="132" width="56" height="14" rx="3" className="fill-surface" />
      <rect x="46" y="40" width="24" height="24" rx="3" className="fill-surface" />
      <path d="M34 168h72" strokeWidth={1.4} />
      <path d="M32 206v6M128 206v6" />
    </Svg>
  );
}

export function CoolingArt(p: P) {
  return (
    <Svg viewBox="0 0 220 180" {...p}>
      <rect x="110" y="22" width="88" height="136" rx="6" className="fill-tile" />
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d={`M114 ${32 + i * 10.5}h80`} strokeWidth={1.3} />
      ))}
      <path d="M130 158v10M150 158v10M170 158v10" />
      <rect x="22" y="30" width="96" height="120" rx="12" className="fill-surface" />
      <Fan cx={70} cy={90} r={40} spin blades={9} />
    </Svg>
  );
}

export function PcArt(p: P) {
  return (
    <Svg viewBox="0 0 200 240" {...p}>
      <rect x="30" y="12" width="140" height="212" rx="12" className="fill-surface" />
      <rect x="44" y="28" width="94" height="180" rx="6" className="fill-tile" />
      <rect x="54" y="42" width="34" height="34" rx="4" className="fill-surface" />
      <rect x="96" y="40" width="5" height="40" rx="1.5" className="fill-surface" />
      <rect x="105" y="40" width="5" height="40" rx="1.5" className="fill-surface" />
      <rect x="52" y="98" width="78" height="22" rx="4" className="fill-surface" />
      <Fan cx={70} cy={109} r={8} blades={5} spin />
      <Fan cx={108} cy={109} r={8} blades={5} spin />
      <rect x="52" y="168" width="78" height="30" rx="4" className="fill-surface" />
      <Fan cx={154} cy={60} r={9} blades={5} spin />
      <Fan cx={154} cy={92} r={9} blades={5} spin />
      <Fan cx={154} cy={124} r={9} blades={5} spin />
      <circle cx="154" cy="196" r="4" />
      <path d="M40 224v8M160 224v8" />
    </Svg>
  );
}

export function MonitorArt(p: P) {
  return (
    <Svg viewBox="0 0 240 190" {...p}>
      <rect x="12" y="12" width="216" height="128" rx="10" className="fill-surface" />
      <rect x="24" y="24" width="192" height="104" rx="4" className="fill-tile" />
      <path d="M40 110 l38 -34 l26 22 l30 -30 l42 42" strokeWidth={1.6} opacity={0.55} />
      <circle cx="176" cy="48" r="9" strokeWidth={1.6} opacity={0.55} />
      <path d="M104 140h32l8 32h-48z" className="fill-surface" />
      <path d="M72 176h96" strokeWidth={3} />
    </Svg>
  );
}

export function PeripheralArt(p: P) {
  return (
    <Svg viewBox="0 0 260 150" {...p}>
      <rect x="10" y="40" width="186" height="78" rx="10" className="fill-surface" />
      {[0, 1, 2].map((row) =>
        Array.from({ length: 10 }, (_, i) => (
          <rect key={`${row}-${i}`} x={22 + i * 16.5} y={52 + row * 18} width="12" height="12" rx="2.5" className="fill-tile" strokeWidth={1.3} />
        )),
      )}
      <rect x="54" y="104" width="98" height="6" rx="3" strokeWidth={1.3} />
      <path d="M226 52c-15 0-24 12-24 30v18c0 18 10 30 24 30s24-12 24-30V82c0-18-9-30-24-30z" className="fill-surface" />
      <path d="M226 52v28M202 80h48" strokeWidth={1.4} />
      <path d="M226 20c0 10-6 14-6 24s6 8 6 8" strokeWidth={1.4} />
    </Svg>
  );
}

export function SoftwareArt(p: P) {
  return (
    <Svg viewBox="0 0 220 170" {...p}>
      <rect x="14" y="16" width="192" height="138" rx="10" className="fill-surface" />
      <path d="M14 42h192" />
      <circle cx="30" cy="29" r="3.5" />
      <circle cx="42" cy="29" r="3.5" />
      <circle cx="54" cy="29" r="3.5" />
      <rect x="32" y="58" width="70" height="40" rx="4" className="fill-tile" />
      <rect x="112" y="58" width="76" height="40" rx="4" className="fill-tile" />
      <rect x="32" y="108" width="156" height="28" rx="4" className="fill-tile" />
      <circle cx="166" cy="122" r="7" className="fill-surface" />
      <path d="M173 122h12v6" strokeWidth={1.6} />
    </Svg>
  );
}

export function PlantArt(p: P) {
  return (
    <Svg viewBox="0 0 80 120" {...p}>
      <path d="M40 78C40 50 22 44 12 40c4 18 12 30 28 38zM40 78c0-30 14-44 28-50-2 22-12 40-28 50zM40 78c0-22-6-40-6-56 10 12 12 34 6 56z" className="fill-tile" strokeWidth={1.6} />
      <path d="M24 78h32l-4 34H28z" className="fill-surface" />
    </Svg>
  );
}

/* ---------------- compositions ---------------- */

/** Desk setup used as the home hero. */
export function HeroArt({ className }: P) {
  return (
    <svg viewBox="0 0 560 380" className={className} aria-hidden {...S}>
      <ellipse cx="290" cy="352" rx="260" ry="14" className="fill-tile" stroke="none" />
      <g transform="translate(6 108)">
        <MonitorInner />
      </g>
      <g transform="translate(338 60) scale(1.15)">
        <PcInner />
      </g>
      <g transform="translate(46 300) scale(0.95)">
        <KeyboardInner />
      </g>
      <g transform="translate(276 296)">
        <path d="M22 4C10 4 4 12 4 24v8c0 12 7 18 18 18s18-6 18-18v-8C40 12 34 4 22 4z" className="fill-surface" />
        <path d="M22 4v18M4 22h36" strokeWidth={1.4} />
      </g>
      <g transform="translate(498 262) scale(0.72)">
        <path d="M40 78C40 50 22 44 12 40c4 18 12 30 28 38zM40 78c0-30 14-44 28-50-2 22-12 40-28 50zM40 78c0-22-6-40-6-56 10 12 12 34 6 56z" className="fill-tile" strokeWidth={1.6} />
        <path d="M24 78h32l-4 34H28z" className="fill-surface" />
      </g>
    </svg>
  );
}

function MonitorInner() {
  return (
    <g>
      <rect x="0" y="0" width="300" height="178" rx="12" className="fill-surface" />
      <rect x="14" y="14" width="272" height="146" rx="5" className="fill-tile" />
      {/* a tiny price chart on screen */}
      <path d="M36 128 l40 -22 l30 12 l38 -40 l34 18 l44 -46 l32 10" strokeWidth={2.2} />
      <circle cx="254" cy="60" r="5" className="fill-surface" />
      <path d="M36 140h220" strokeWidth={1.2} opacity={0.4} />
      <rect x="36" y="30" width="60" height="8" rx="4" className="fill-surface" strokeWidth={1.2} />
      <path d="M134 178h32l10 46h-52z" className="fill-surface" />
      <path d="M100 228h100" strokeWidth={3} />
    </g>
  );
}

function PcInner() {
  return (
    <g>
      <rect x="0" y="0" width="130" height="236" rx="12" className="fill-surface" />
      <rect x="12" y="14" width="84" height="206" rx="6" className="fill-tile" />
      <rect x="22" y="28" width="30" height="30" rx="4" className="fill-surface" />
      <rect x="60" y="26" width="5" height="36" rx="1.5" className="fill-surface" />
      <rect x="69" y="26" width="5" height="36" rx="1.5" className="fill-surface" />
      <rect x="20" y="84" width="70" height="22" rx="4" className="fill-surface" />
      <Fan cx={38} cy={95} r={8} blades={5} spin />
      <Fan cx={72} cy={95} r={8} blades={5} spin />
      <rect x="20" y="176" width="70" height="30" rx="4" className="fill-surface" />
      <Fan cx={113} cy={46} r={9} blades={5} spin />
      <Fan cx={113} cy={80} r={9} blades={5} spin />
      <Fan cx={113} cy={114} r={9} blades={5} spin />
      <circle cx="113" cy="208" r="4" />
      <path d="M10 236v8M120 236v8" />
    </g>
  );
}

function KeyboardInner() {
  return (
    <g>
      <rect x="0" y="0" width="226" height="56" rx="9" className="fill-surface" />
      {[0, 1, 2].map((row) =>
        Array.from({ length: 13 }, (_, i) => (
          <rect key={`${row}-${i}`} x={10 + i * 16.5} y={8 + row * 13} width="11" height="9" rx="2" className="fill-tile" strokeWidth={1.1} />
        )),
      )}
    </g>
  );
}

/* ---------------- small feature icons ---------------- */

export function TagIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden {...S}>
      <path d="M6 24V8a2 2 0 0 1 2-2h16l18 18-18 18z" className="fill-tile" />
      <circle cx="15" cy="15" r="3.5" className="fill-surface" />
      <path d="M22 30l12-12" />
    </svg>
  );
}
export function PinIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden {...S}>
      <path d="M24 44s14-13 14-25a14 14 0 0 0-28 0c0 12 14 25 14 25z" className="fill-tile" />
      <circle cx="24" cy="19" r="5" className="fill-surface" />
    </svg>
  );
}
export function ClockIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden {...S}>
      <circle cx="24" cy="24" r="18" className="fill-tile" />
      <path d="M24 13v11l7 5" />
    </svg>
  );
}

/* ---------------- lookup ---------------- */

const BY_CATEGORY: Record<string, (p: P) => React.ReactElement> = {
  gpu: GpuArt,
  cpu: CpuArt,
  motherboard: MotherboardArt,
  ram: RamArt,
  storage: StorageArt,
  psu: PsuArt,
  case: CaseArt,
  cooling: CoolingArt,
  prebuilt: PcArt,
  monitor: MonitorArt,
  peripheral: PeripheralArt,
  software: SoftwareArt,
  all: PcArt,
};

export function CategoryArt({ category, className }: { category: string; className?: string }) {
  const Art = BY_CATEGORY[category] ?? PcArt;
  return <Art className={className} />;
}
