import { useMemo, useState } from "react";
import type { Detection, Keyframe } from "../api";

// A keyframe on the dark stage with its detection boxes as a magenta
// overprint. Classes can be switched off; hovering a box names it.
export default function FrameViewer({ keyframe, detections }: { keyframe: Keyframe; detections: Detection[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<Detection | null>(null);
  const [boxes, setBoxes] = useState(true);

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

  const shown = boxes ? detections.filter((d) => !hidden.has(d.label)) : [];
  const source = keyframe.meta.analysis?.box_source;
  const sw = 1.6; // screen pixels (non-scaling stroke)

  return (
    <figure className="m-0">
      <div className="relative flex justify-center overflow-hidden rounded-[var(--radius-media)] bg-black">
        <div className="relative">
          <img src={keyframe.imageUrl} alt={keyframe.description || "关键帧"} className="block h-auto max-h-[68vh] w-auto max-w-full" />
          <svg viewBox={`0 0 ${keyframe.width} ${keyframe.height}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            {shown.map((d) => {
              const on = hover?.id === d.id;
              return (
                <rect key={d.id} x={d.x} y={d.y} width={d.w} height={d.h} rx={keyframe.width / 640}
                  fill={on ? "rgba(255,95,162,0.25)" : "none"} stroke="#ff5fa2" strokeOpacity={on ? 1 : 0.9}
                  strokeWidth={on ? sw * 1.8 : sw} vectorEffect="non-scaling-stroke" style={{ pointerEvents: "all" }}
                  onMouseEnter={() => setHover(d)} onMouseLeave={() => setHover(null)} />
              );
            })}
          </svg>
        </div>
        {hover && (
          <div className="pointer-events-none absolute top-3 left-3 rounded-md bg-stage/85 px-2.5 py-1 text-[13px] text-white backdrop-blur">
            {hover.labelZh || hover.label}
            {hover.score != null && <span className="tnum ml-2 text-white/65">置信度 {hover.score.toFixed(2)}</span>}
          </div>
        )}
      </div>
      <figcaption className="mt-4 flex flex-wrap items-center gap-2">
        {classes.length === 0 && <span className="text-[13px] text-white/50">画面中没有检测到目标</span>}
        {classes.length > 0 && (
          <button onClick={() => setBoxes((v) => !v)} aria-pressed={boxes}
            className="mr-1 rounded-full border border-stage-line px-3 py-0.5 text-[13px] text-white/75 hover:text-white">
            {boxes ? "隐藏目标框" : "显示目标框"}
          </button>
        )}
        {boxes && classes.map(([label, c]) => {
          const off = hidden.has(label);
          return (
            <button key={label} onClick={() => toggle(label)} aria-pressed={!off}
              className={`rounded-full px-3 py-0.5 text-[13px] transition-colors ${off ? "bg-transparent text-white/40 line-through ring-1 ring-stage-line" : "bg-magenta-glow/15 text-[#ffc2dc] ring-1 ring-magenta-glow/40"}`}>
              {c.zh}<span className="tnum ml-1.5 font-semibold">{c.n}</span>
            </button>
          );
        })}
        {source && (
          <span className="ml-auto text-[12px] text-white/45">
            {source === "detector" ? `目标框来自检测模型 ${keyframe.meta.analysis?.detector ?? ""}` : source === "vlm" ? "目标框来自视觉模型" : "本地兜底描述，无目标框"}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
