import { useEffect, useMemo, useState } from "react";
import { geoSourceLabel, typeLabel, type GeoOverview, type GeoPoint } from "../api";
import { clock } from "../format";
import { navigate } from "../router";
import GeoMap, { geoOverview, type MapMarker } from "../components/GeoMap";
import { ErrorNote, Loading } from "../components/ui";

// Colours by how the position was obtained: metadata (exact) in chart blue,
// visual estimates in magenta, coarse guesses in grey.
const sourceColor = (s: string) =>
  s === "telemetry" || s === "exif" || s === "metadata" || s === "geotiff" ? "#2a62a3" : s.startsWith("visual") ? "#b01f68" : "#7d8a96";

export default function MapPage({ params }: { params: URLSearchParams }) {
  const [data, setData] = useState<GeoOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestedRaw = params.get("collection");
  const requested = requestedRaw === "all" ? "" : requestedRaw;
  const [selected, setSelected] = useState<GeoPoint | null>(null);

  useEffect(() => {
    geoOverview().then(setData, (e: Error) => setError(e.message));
  }, []);

  const collections = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of data?.points ?? []) m.set(p.collection, (m.get(p.collection) ?? 0) + 1);
    return [...m.entries()].sort();
  }, [data]);

  // Open on the collection with the most located points (one region, a
  // useful zoom); "all" spans continents.
  const collection = requested ?? [...collections].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const points = useMemo(() => (data?.points ?? []).filter((p) => !collection || p.collection === collection), [data, collection]);
  const markers: MapMarker[] = useMemo(() => points.map((p) => ({
    lat: p.lat, lon: p.lon, color: sourceColor(p.geoSource), selected: selected?.keyframeId === p.keyframeId,
    accuracyM: selected?.keyframeId === p.keyframeId ? p.geoAccuracyM : null,
    onClick: () => setSelected(p),
  })), [points, selected]);

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;

  return (
    <div className="relative flex h-screen flex-col">
      <div className="flex flex-wrap items-center gap-4 border-b border-line bg-surface px-4 sm:px-8 py-3">
        <h1 className="text-[22px] font-semibold">地图</h1>
        <label className="text-[14px] text-ink-2">
          集合
          <select value={collection} onChange={(e) => navigate("/map", { collection: e.target.value || "all" }, true)}
            className="ml-2 rounded-[3px] border border-line bg-surface px-2 py-1 text-[14px] text-ink">
            <option value="">全部（{data.points.length}）</option>
            {collections.map(([c, n]) => <option key={c} value={c}>{c}（{n}）</option>)}
          </select>
        </label>
        <p className="flex flex-wrap gap-x-4 text-[13px] text-ink-2">
          <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-chart align-middle" />飞行记录或照片元数据</span>
          <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-magenta align-middle" />与卫星底图视觉匹配推算</span>
          <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-ink-3 align-middle" />地标推断（城市级）</span>
        </p>
      </div>
      <div className="relative flex-1">
        <GeoMap markers={markers} basemaps={data.basemaps} tileUrl={data.tileUrl} fitKey={collection || "all"} className="h-full rounded-none border-0" />
        {selected && (
          <div className="absolute top-4 right-4 z-[1000] w-[320px] rounded-[3px] border border-line bg-surface p-3 shadow-[0_6px_24px_rgba(22,33,44,0.18)]">
            <button onClick={() => setSelected(null)} aria-label="关闭" className="float-right px-1 text-ink-3 hover:text-ink">✕</button>
            <a href={`#/assets/${selected.assetId}?kf=${selected.keyframeId}`} className="font-medium hover:text-chart">{selected.filename}</a>
            <p className="text-[13px] text-ink-3">
              {typeLabel[selected.assetType]}
              {selected.assetType === "video" && <span className="figures ml-2">{clock(selected.tsSec)}</span>}
            </p>
            <img src={selected.imageUrl} alt="" className="mt-2 aspect-video w-full rounded-[2px] object-cover" />
            <p className="figures mt-2 text-[15px]">{selected.lat.toFixed(5)}, {selected.lon.toFixed(5)}</p>
            <p className="text-[13px] text-ink-2">
              {geoSourceLabel[selected.geoSource] ?? selected.geoSource}
              {selected.geoAccuracyM != null && `，误差约 ${Math.round(selected.geoAccuracyM)} 米`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
