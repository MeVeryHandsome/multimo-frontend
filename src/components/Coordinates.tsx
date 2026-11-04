import { dms, hemisphere } from "../format";
import { geoSourceLabel } from "../api";

// The position readout: degrees, minutes and seconds set large in the light
// weight, with the accuracy and how the position was obtained underneath.
export default function Coordinates({ lat, lon, accuracyM, source }: {
  lat: number | null;
  lon: number | null;
  accuracyM?: number | null;
  source?: string;
}) {
  if (lat == null || lon == null) {
    return (
      <div>
        <p className="text-[17px] font-semibold text-ink-2">位置未知</p>
        <p className="mt-1 text-[13px] text-ink-3">没有飞行记录或 GPS，也没有覆盖这里的参考底图。</p>
      </div>
    );
  }
  const [ns, ew] = hemisphere(lat, lon);
  const a = dms(lat);
  const b = dms(lon);
  const row = (h: string, v: { deg: number; min: number; sec: string }) => (
    <span className="flex items-baseline gap-2">
      <span className="w-4 text-[15px] font-semibold text-geo">{h}</span>
      <span>{v.deg}°{String(v.min).padStart(2, "0")}′{v.sec.padStart(4, "0")}″</span>
    </span>
  );
  return (
    <div>
      <p className="tnum text-[36px] leading-[1.12] font-light tracking-[-0.01em] text-ink" aria-label={`${ns} ${lat.toFixed(5)}, ${ew} ${lon.toFixed(5)}`}>
        {row(ns, a)}
        {row(ew, b)}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
        <div>
          <dt className="text-ink-3">十进制</dt>
          <dd className="tnum">{lat.toFixed(5)}, {lon.toFixed(5)}</dd>
        </div>
        {accuracyM != null && (
          <div>
            <dt className="text-ink-3">误差</dt>
            <dd className="tnum">约 {accuracyM >= 1000 ? `${(accuracyM / 1000).toFixed(0)} 公里` : `${Math.round(accuracyM)} 米`}</dd>
          </div>
        )}
        {source && (
          <div className="col-span-2">
            <dt className="text-ink-3">定位方式</dt>
            <dd>{geoSourceLabel[source] ?? source}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
