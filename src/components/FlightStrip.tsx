import { useEffect, useRef } from "react";
import type { Keyframe } from "../api";
import { clock } from "../format";

// The keyframes of a video along its time axis, on the dark stage: the
// ruler shows where each keyframe falls in the footage, the strip below
// shows the frames.
export default function FlightStrip({ keyframes, duration, selected, onSelect }: {
  keyframes: Keyframe[];
  duration: number;
  selected: number;
  onSelect: (id: number) => void;
}) {
  const strip = useRef<HTMLOListElement>(null);
  // Keep the selected frame visible by scrolling the strip itself (never the page).
  useEffect(() => {
    const box = strip.current;
    const item = box?.querySelector<HTMLElement>(`[data-kf="${selected}"]`);
    if (!box || !item) return;
    const left = item.offsetLeft - box.offsetLeft;
    if (left < box.scrollLeft || left + item.offsetWidth > box.scrollLeft + box.clientWidth) {
      box.scrollTo({ left: Math.max(0, left - box.clientWidth / 2 + item.offsetWidth / 2), behavior: "smooth" });
    }
  }, [selected]);

  const total = Math.max(duration, keyframes.at(-1)?.tsSec ?? 0, 1);
  const ticks = [];
  const step = total > 600 ? 120 : total > 240 ? 60 : total > 90 ? 30 : total > 30 ? 10 : 5;
  for (let t = 0; t <= total; t += step) ticks.push(t);
  const sel = keyframes.find((k) => k.id === selected);

  return (
    <div className="mt-6 border-t border-stage-line pt-5">
      <div className="mb-3 flex items-baseline justify-between text-[13px] text-white/55">
        <span>关键帧 <span className="tnum text-white/85">{keyframes.length}</span></span>
        {sel && <span className="tnum">{clock(sel.tsSec)} / {clock(total)}</span>}
      </div>
      <div className="relative h-9" aria-hidden="true">
        <div className="absolute top-[14px] right-0 left-0 h-px bg-stage-line" />
        {ticks.map((t) => (
          <div key={t} className="absolute top-[14px]" style={{ left: `${(t / total) * 100}%` }}>
            <div className="h-1.5 w-px bg-white/25" />
            <div className="tnum -translate-x-1/2 pt-1 text-[11px] text-white/40">{clock(t).replace(/\.0$/, "")}</div>
          </div>
        ))}
        {keyframes.map((k) => (
          <button key={k.id} tabIndex={-1} onClick={() => onSelect(k.id)} title={clock(k.tsSec)}
            className={`absolute -translate-x-1/2 rounded-full ${k.id === selected ? "top-[7px] h-[15px] w-[15px] bg-magenta-glow ring-4 ring-magenta-glow/25" : "top-[10px] h-[9px] w-[9px] bg-white/55 hover:bg-white"}`}
            style={{ left: `${(k.tsSec / total) * 100}%` }} />
        ))}
      </div>
      <ol ref={strip} className="mt-3 flex gap-2.5 overflow-x-auto pb-2" aria-label="关键帧">
        {keyframes.map((k) => (
          <li key={k.id} data-kf={k.id} className="shrink-0">
            <button onClick={() => onSelect(k.id)} aria-current={k.id === selected ? "true" : undefined}
              aria-label={`${clock(k.tsSec)} 的关键帧`} className="group block w-[132px] text-left">
              <img src={k.imageUrl} alt="" loading="lazy"
                className={`aspect-video w-full rounded-md object-cover transition-opacity ${k.id === selected ? "opacity-100 ring-2 ring-magenta-glow ring-offset-2 ring-offset-stage" : "opacity-60 group-hover:opacity-100"}`} />
              <span className={`tnum mt-1.5 block text-[12px] ${k.id === selected ? "text-white" : "text-white/50"}`}>{clock(k.tsSec)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
