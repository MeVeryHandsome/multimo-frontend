import type { ReactNode } from "react";

export function PageHeader({ title, children, aside }: { title: ReactNode; children?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b border-line bg-surface px-4 sm:px-8 pt-6 pb-4">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight">{title}</h1>
        {children && <div className="mt-1 text-ink-2">{children}</div>}
      </div>
      {aside && <div className="flex flex-wrap items-center gap-3">{aside}</div>}
    </header>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-[3px] border border-line bg-sunk p-0.5">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`shrink-0 rounded-[2px] px-3 py-1 text-[14px] whitespace-nowrap ${value === o.value ? "bg-surface font-semibold text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-ink-2 hover:text-ink"}`}>
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
      <dd className="truncate">{children}</dd>
    </div>
  );
}

export function Loading({ what = "加载中" }: { what?: string }) {
  return <p className="px-4 sm:px-8 py-10 text-ink-3">{what}…</p>;
}

export function ErrorNote({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div role="alert" className="mx-4 sm:mx-8 my-6 border-l-[3px] border-fail bg-fail-wash px-4 py-3 text-[14px]">
      {error}
      {retry && <button onClick={retry} className="ml-3 text-chart underline underline-offset-2">重试</button>}
    </div>
  );
}

export function Button({ children, onClick, disabled, kind = "primary", type = "button" }: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  kind?: "primary" | "quiet";
  type?: "button" | "submit";
}) {
  const cls = kind === "primary"
    ? "bg-ink text-white hover:bg-[#24323f] disabled:bg-ink-3"
    : "border border-line bg-surface text-ink hover:border-ink-3 disabled:text-ink-3";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-[3px] px-4 py-1.5 text-[14px] font-medium ${cls}`}>
      {children}
    </button>
  );
}

export function Verdict({ pass, primary = true }: { pass: boolean; primary?: boolean }) {
  if (!primary) return <span className="text-[13px] text-ink-3">参考</span>;
  return pass
    ? <span className="rounded-[2px] bg-pass-wash px-1.5 py-0.5 text-[13px] font-semibold text-pass">达标</span>
    : <span className="rounded-[2px] bg-fail-wash px-1.5 py-0.5 text-[13px] font-semibold text-fail">未达标</span>;
}
