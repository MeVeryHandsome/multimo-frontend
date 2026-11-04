import { useMemo, useState } from "react";
import type { Detection, Keyframe } from "../api";

// A keyframe with its detection boxes drawn as chart overprints. Classes can
// be switched off; hovering a box shows its label and confidence.
export default function FrameViewer({ keyframe, detections }: { keyframe: Keyframe; detections: Detection[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<Detection | null>(null);

  const classes = useMemo(() => {
    const m = new Map<string, { zh: string; n: number }>();
    for (const d of detections) {
      const c = m.get(d.label) ?? { zh: d.labelZh || d.label, n: 0 };
      c.n++;
      m.set(d.label, c);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [detections]);

  const toggle = (label: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(label)) n.delete(label);
      else n.add(label);
      return n;
    });

  const shown = detections.filter((d) => !hidden.has(d.label));
  const source = keyframe.meta.analysis?.box_source;
  const sw = Math.max(1.5, keyframe.width / 640);

  return (
    <figure className="m-0">
      <div className="relative overflow-hidden rounded-[3px] bg-ink">
        <img src={keyframe.imageUrl} alt={keyframe.description || "关键帧"} className="block h-auto w-full" />
        <svg viewBox={`0 0 ${keyframe.width} ${keyframe.height}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          {shown.map((d) => (
            <rect key={d.id} x={d.x} y={d.y} width={d.w} height={d.h} fill={hover?.id === d.id ? "rgba(176,31,104,0.22)" : "none"}
              stroke="#e0458f" strokeWidth={hover?.id === d.id ? sw * 1.8 : sw}
              onMouseEnter={() => setHover(d)} onMouseLeave={() => setHover(null)} style={{ pointerEvents: "all" }} />
          ))}
        </svg>
        {hover && (
          <div className="pointer-events-none absolute top-2 left-2 rounded-[2px] bg-ink/85 px-2 py-1 text-[13px] text-white">
            {hover.labelZh || hover.label}
            {hover.score != null && <span className="figures ml-2 text-white/70">{hover.score.toFixed(2)}</span>}
          </div>
        )}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {classes.length === 0 && <span className="text-[13px] text-ink-3">没有检测到目标</span>}
        {classes.map(([label, c]) => {
          const off = hidden.has(label);
          return (
            <button key={label} onClick={() => toggle(label)} aria-pressed={!off}
              className={`rounded-[2px] border px-2 py-0.5 text-[13px] ${off ? "border-line text-ink-3 line-through" : "border-magenta/40 bg-magenta-wash text-magenta"}`}>
              {c.zh}<span className="figures ml-1.5">{c.n}</span>
            </button>
          );
        })}
        {source && (
          <span className="ml-auto text-[12px] text-ink-3">
            {source === "detector" ? `目标框来自检测模型 ${keyframe.meta.analysis?.detector ?? ""}` : source === "vlm" ? "目标框来自视觉模型" : "本地兜底描述，无目标框"}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
