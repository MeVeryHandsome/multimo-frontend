import type { ReactNode } from "react";

// Page: a centred column with consistent gutters.
export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={`mx-auto w-full ${wide ? "max-w-[1600px]" : "max-w-[1280px]"} px-4 pt-8 pb-16 sm:px-8`}>{children}</div>;
}

export function PageTitle({ title, children, aside }: { title: ReactNode; children?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-semibold">{title}</h1>
        {children && <div className="mt-1.5 max-w-[68ch] text-ink-2">{children}</div>}
      </div>
      {aside && <div className="flex flex-wrap items-center gap-3">{aside}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-full bg-sunk p-1">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`shrink-0 rounded-full px-3.5 py-1 text-[14px] whitespace-nowrap transition-colors ${value === o.value ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(15,23,32,0.12)]" : "text-ink-2 hover:text-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="truncate tnum">{children}</dd>
    </div>
  );
}

export function Loading({ what = "加载中" }: { what?: string }) {
  return <p className="py-16 text-center text-ink-3">{what}…</p>;
}

export function ErrorNote({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div role="alert" className="my-4 rounded-[10px] border border-fail/25 bg-fail-soft px-4 py-3 text-[14px] text-ink">
      {error}
      {retry && <button onClick={retry} className="ml-3 font-semibold text-fail hover:underline">重试</button>}
    </div>
  );
}

export function Button({ children, onClick, disabled, kind = "primary", type = "button", size = "md" }: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  kind?: "primary" | "quiet";
  type?: "button" | "submit";
  size?: "md" | "lg";
}) {
  const cls = kind === "primary"
    ? "bg-ink text-white hover:bg-[#2a3542] disabled:bg-ink-3"
    : "border border-line-strong bg-surface text-ink hover:border-ink-3 disabled:text-ink-3";
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`shrink-0 rounded-full font-semibold transition-colors ${size === "lg" ? "h-12 px-7 text-[15px]" : "h-9 px-5 text-[14px]"} ${cls}`}>
      {children}
    </button>
  );
}

export function Verdict({ pass, primary = true }: { pass: boolean; primary?: boolean }) {
  if (!primary) return <span className="text-[13px] text-ink-3">参考</span>;
  return pass
    ? <span className="inline-flex items-center gap-1 rounded-full bg-pass-soft px-2.5 py-0.5 text-[13px] font-semibold text-pass"><Tick />达标</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-fail-soft px-2.5 py-0.5 text-[13px] font-semibold text-fail"><Cross />未达标</span>;
}

function Tick() {
  return <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Cross() {
  return <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "geo" | "magenta" }) {
  const cls = tone === "geo" ? "bg-geo-soft text-geo" : tone === "magenta" ? "bg-magenta-soft text-magenta" : "bg-sunk text-ink-2";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] ${cls}`}>{children}</span>;
}
