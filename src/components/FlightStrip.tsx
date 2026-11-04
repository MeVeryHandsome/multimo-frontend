import { useEffect, useRef } from "react";
import type { Keyframe } from "../api";
import { clock } from "../format";

// The keyframes of a video along its time axis: the ruler shows where each
// keyframe falls in the footage, the strip below shows the frames.
export default function FlightStrip({ keyframes, duration, selected, onSelect }: {
  keyframes: Keyframe[];
  duration: number;
  selected: number;
  onSelect: (id: number) => void;
}) {
  const strip = useRef<HTMLOListElement>(null);
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>(`[data-kf="${selected}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selected]);

  const total = Math.max(duration, keyframes.at(-1)?.tsSec ?? 0, 1);
  const ticks = [];
  const step = total > 600 ? 120 : total > 240 ? 60 : total > 90 ? 30 : 10;
  for (let t = 0; t <= total; t += step) ticks.push(t);

  return (
    <div className="rounded-[3px] border border-line bg-surface px-4 pt-3 pb-4">
      <div className="relative h-10" aria-hidden="true">
        {keyframes.map((k) => (
          <button key={k.id} tabIndex={-1} onClick={() => onSelect(k.id)} title={clock(k.tsSec)}
            className={`absolute top-0 w-[3px] -translate-x-1/2 rounded-t-[1px] ${k.id === selected ? "h-[18px] bg-magenta" : "h-3 top-[6px] bg-ink-3/70 hover:bg-ink"}`}
            style={{ left: `${(k.tsSec / total) * 100}%` }} />
        ))}
        <div className="absolute top-[18px] right-0 left-0 h-px bg-ink-3" />
        {ticks.map((t) => (
          <div key={t} className="absolute top-[18px]" style={{ left: `${(t / total) * 100}%` }}>
            <div className="h-1.5 w-px bg-ink-3" />
            <div className="figures -translate-x-1/2 pt-0.5 text-[11px] text-ink-3">{clock(t).replace(/\.0$/, "")}</div>
          </div>
        ))}
      </div>
      <ol ref={strip} className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="关键帧">
        {keyframes.map((k) => (
          <li key={k.id} data-kf={k.id} className="shrink-0">
            <button onClick={() => onSelect(k.id)} aria-current={k.id === selected ? "true" : undefined}
              className={`block w-[124px] text-left ${k.id === selected ? "" : "opacity-80 hover:opacity-100"}`}>
              <img src={k.imageUrl} alt="" loading="lazy"
                className={`aspect-video w-full rounded-[2px] object-cover ${k.id === selected ? "outline-[2.5px] outline-offset-1 outline-magenta outline" : ""}`} />
              <span className="figures mt-1 flex justify-between text-[12px] text-ink-2">
                <span>{clock(k.tsSec)}</span>
                {k.detections > 0 && <span className="text-ink-3">{k.detections} 个目标</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
