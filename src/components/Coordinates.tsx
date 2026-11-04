import { dms, hemisphere } from "../format";
import { geoSourceLabel } from "../api";

// The position readout is the one loud element of the interface: chart-style
// degrees, minutes and seconds in condensed figures, with the accuracy and
// how the position was obtained in plain words underneath.
export default function Coordinates({ lat, lon, accuracyM, source }: {
  lat: number | null;
  lon: number | null;
  accuracyM?: number | null;
  source?: string;
}) {
  if (lat == null || lon == null) {
    return (
      <div className="py-2">
        <p className="text-[17px] font-semibold text-ink-2">位置未知</p>
        <p className="mt-2 text-[13px] text-ink-3">没有飞行记录、GPS，也没有可匹配的参考底图。</p>
      </div>
    );
  }
  const [ns, ew] = hemisphere(lat, lon);
  const a = dms(lat);
  const b = dms(lon);
  return (
    <div>
      <p className="figures text-[38px] leading-[1.02] font-semibold tracking-tight text-ink" aria-label={`${ns} ${lat.toFixed(5)}, ${ew} ${lon.toFixed(5)}`}>
        <span className="block">
          <span className="text-chart">{ns}</span>{a.deg}°{String(a.min).padStart(2, "0")}′{a.sec.padStart(4, "0")}″
        </span>
        <span className="block">
          <span className="text-chart">{ew}</span>{b.deg}°{String(b.min).padStart(2, "0")}′{b.sec.padStart(4, "0")}″
        </span>
      </p>
      <p className="mt-2 text-[13px] text-ink-2">
        <span className="figures text-[15px] text-ink">{lat.toFixed(5)}, {lon.toFixed(5)}</span>
        {accuracyM != null && <span className="ml-3">误差约 {accuracyM >= 1000 ? `${(accuracyM / 1000).toFixed(0)} 公里` : `${Math.round(accuracyM)} 米`}</span>}
      </p>
      {source && <p className="text-[13px] text-ink-3">{geoSourceLabel[source] ?? source}</p>}
    </div>
  );
}
