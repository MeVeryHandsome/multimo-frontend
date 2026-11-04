import { useEffect, useMemo, useState } from "react";
import { geoSourceLabel, typeLabel, type GeoOverview, type GeoPoint } from "../api";
import { clock } from "../format";
import { navigate } from "../router";
import GeoMap, { geoOverview, type MapMarker } from "../components/GeoMap";
import { ErrorNote, Loading } from "../components/ui";

// Colours by how the position was obtained: metadata (exact) in blue,
// visual estimates in magenta, coarse guesses in grey.
const sourceColor = (s: string) =>
  s === "telemetry" || s === "exif" || s === "metadata" || s === "geotiff" ? "#2b63b5" : s.startsWith("visual") ? "#c2185b" : "#8892a0";

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

  if (error) return <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-8"><ErrorNote error={error} /></div>;
  if (!data) return <Loading />;

  return (
    <div className="relative h-[calc(100vh-61px)]">
      <GeoMap markers={markers} basemaps={data.basemaps} tileUrl={data.tileUrl} fitKey={collection || "all"} className="h-full rounded-none border-0" />

      <div className="panel float absolute top-4 left-4 z-[1000] w-[300px] p-4 sm:left-16">
        <h1 className="text-[19px] font-semibold">地图</h1>
        <p className="mt-0.5 text-[13px] text-ink-2">已定位的关键帧 <span className="tnum font-semibold text-ink">{points.length}</span> 个</p>
        <label className="mt-3 block text-[12px] text-ink-3">
          集合
          <select value={collection} onChange={(e) => { setSelected(null); navigate("/map", { collection: e.target.value || "all" }, true); }}
            className="mt-1 block h-9 w-full rounded-full border border-line bg-surface px-3 text-[14px] text-ink">
            <option value="">全部（{data.points.length}）</option>
            {collections.map(([c, n]) => <option key={c} value={c}>{c}（{n}）</option>)}
          </select>
        </label>
        <ul className="mt-4 space-y-1.5 text-[13px] text-ink-2">
          <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-geo" />飞行记录或照片元数据</li>
          <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-magenta" />与卫星底图视觉匹配推算</li>
          <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-ink-3" />地标推断（城市级）</li>
          {data.basemaps.length > 0 && <li className="flex items-center gap-2"><span className="h-2.5 w-3.5 rounded-[2px] border border-dashed border-geo" />参考卫星底图范围</li>}
        </ul>
      </div>

      {selected && (
        <div className="panel float absolute top-4 right-4 z-[1000] w-[320px] overflow-hidden">
          <img src={selected.imageUrl} alt="" className="aspect-video w-full object-cover" />
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <a href={`#/assets/${selected.assetId}?kf=${selected.keyframeId}`} className="min-w-0 truncate font-semibold hover:text-geo">{selected.filename}</a>
              <button onClick={() => setSelected(null)} aria-label="关闭" className="-mt-0.5 shrink-0 rounded-full px-1.5 text-ink-3 hover:bg-sunk hover:text-ink">✕</button>
            </div>
            <p className="text-[13px] text-ink-3">
              {typeLabel[selected.assetType]}
              {selected.assetType === "video" && <span className="tnum ml-2">{clock(selected.tsSec)}</span>}
            </p>
            <p className="tnum mt-3 text-[20px] font-light">{selected.lat.toFixed(5)}, {selected.lon.toFixed(5)}</p>
            <p className="text-[13px] text-ink-2">
              {geoSourceLabel[selected.geoSource] ?? selected.geoSource}
              {selected.geoAccuracyM != null && `，误差约 ${Math.round(selected.geoAccuracyM)} 米`}
            </p>
            <a href={`#/assets/${selected.assetId}?kf=${selected.keyframeId}`} className="mt-3 inline-block text-[14px] font-semibold text-geo hover:underline">查看素材</a>
          </div>
        </div>
      )}
    </div>
  );
}
