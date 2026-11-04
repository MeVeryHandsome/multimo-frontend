import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api, postJSON, statusLabel, typeLabel,
  type Asset, type Basemap, type Detection, type Keyframe, type SearchResponse, type TrackPoint,
} from "../api";
import { bytes, clock, dateTime, duration } from "../format";
import { navigate } from "../router";
import Coordinates from "../components/Coordinates";
import FlightStrip from "../components/FlightStrip";
import FrameViewer from "../components/FrameViewer";
import GeoMap, { geoOverview } from "../components/GeoMap";
import { Button, ErrorNote, Field, Loading } from "../components/ui";
import { attrZh, objectZh as labelZh } from "../labels";

type AssetDetail = { asset: Asset; tasks: { kind: string; status: string; message?: string; error?: string }[]; counts: { keyframes: number; detections: number; chunks: number } };

export default function AssetView({ id, params }: { id: number; params: URLSearchParams }) {
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [kfs, setKfs] = useState<Keyframe[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<AssetDetail>(`/assets/${id}`).then(setDetail, (e: Error) => setError(e.message));
    api<{ list: Keyframe[] }>(`/assets/${id}/keyframes`).then((r) => setKfs(r.list), () => setKfs([]));
  }, [id]);
  useEffect(load, [load]);

  const processing = detail && detail.asset.status !== "ready" && detail.asset.status !== "failed";
  useEffect(() => {
    if (!processing) return;
    const t = window.setTimeout(load, 4000);
    return () => window.clearTimeout(t);
  }, [processing, load, detail]);

  if (error) return <ErrorNote error={error} retry={load} />;
  if (!detail || !kfs) return <Loading />;
  const a = detail.asset;

  return (
    <div>
      <AssetHeader a={a} detail={detail} onReprocess={load} />
      {a.type === "document"
        ? <DocumentBody a={a} chunks={detail.counts.chunks} />
        : <VisualBody a={a} kfs={kfs} selectedId={Number(params.get("kf")) || kfs[0]?.id} />}
    </div>
  );
}

function AssetHeader({ a, detail, onReprocess }: { a: Asset; detail: AssetDetail; onReprocess: () => void }) {
  const [busy, setBusy] = useState(false);
  const reprocess = async () => {
    setBusy(true);
    try {
      await postJSON(`/assets/${a.id}/reprocess`, {});
      onReprocess();
    } finally {
      setBusy(false);
    }
  };
  const failed = detail.tasks.find((t) => t.status === "failed");
  const running = detail.tasks.find((t) => t.status === "running" || t.status === "pending");
  return (
    <header className="border-b border-line bg-surface px-4 sm:px-8 pt-5 pb-4">
      <a href="#/assets" className="text-[13px] text-chart underline-offset-2 hover:underline">返回素材列表</a>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h1 className="min-w-0 truncate text-[26px] leading-tight font-semibold tracking-tight">{(a.meta?.title as string) || a.filename}</h1>
        <div className="flex items-center gap-3">
          {a.status !== "ready" && (
            <span className={a.status === "failed" ? "text-fail" : "text-chart"}>
              {statusLabel[a.status]}{running ? `：${running.kind}${running.message ? ` ${running.message}` : ""}` : ""}
            </span>
          )}
          <Button kind="quiet" onClick={reprocess} disabled={busy}>{busy ? "已提交" : "重新处理"}</Button>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-[14px] sm:grid-cols-3 lg:grid-cols-6">
        <Field label="类型">{typeLabel[a.type]}（{a.format.toUpperCase()}）</Field>
        <Field label="集合">{a.collection}</Field>
        {a.width && a.height ? <Field label="分辨率"><span className="figures">{a.width} × {a.height}</span></Field> : null}
        {a.durationSec ? <Field label="时长"><span className="figures">{duration(a.durationSec)}</span></Field> : null}
        {a.pageCount && a.format === "pdf" ? <Field label="页数"><span className="figures">{a.pageCount}</span></Field> : null}
        {a.capturedAt ? <Field label="拍摄时间"><span className="figures">{dateTime(a.capturedAt)}</span></Field> : null}
        <Field label="大小"><span className="figures">{bytes(a.sizeBytes)}</span></Field>
        {a.filename !== ((a.meta?.title as string) || a.filename) && <Field label="文件名">{a.filename}</Field>}
      </dl>
      {failed && <p className="mt-3 text-[13px] text-fail">{failed.kind} 失败：{failed.error}</p>}
    </header>
  );
}

function VisualBody({ a, kfs, selectedId }: { a: Asset; kfs: Keyframe[]; selectedId: number | undefined }) {
  const [current, setCurrent] = useState<{ keyframe: Keyframe; detections: Detection[] } | null>(null);
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [basemaps, setBasemaps] = useState<Basemap[]>([]);
  const [tileUrl, setTileUrl] = useState<string>("");

  useEffect(() => {
    if (!selectedId) return;
    api<{ keyframe: Keyframe; detections: Detection[] }>(`/keyframes/${selectedId}`).then(setCurrent, () => setCurrent(null));
  }, [selectedId]);
  useEffect(() => {
    if (a.type === "video") api<{ points: TrackPoint[] }>(`/assets/${a.id}/track`).then((r) => setTrack(r.points ?? []), () => {});
    geoOverview().then((o) => { setBasemaps(o.basemaps); setTileUrl(o.tileUrl); }, () => {});
  }, [a.id, a.type]);

  const select = (kf: number) => navigate(`/assets/${a.id}`, { kf }, true);

  // Arrow keys step through keyframes.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      const i = kfs.findIndex((k) => k.id === selectedId);
      if (e.key === "ArrowRight" && i < kfs.length - 1) select(kfs[i + 1].id);
      if (e.key === "ArrowLeft" && i > 0) select(kfs[i - 1].id);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  const markers = useMemo(() => kfs.filter((k) => k.lat != null && k.lon != null).map((k) => ({
    lat: k.lat!, lon: k.lon!, accuracyM: k.id === selectedId ? k.geoAccuracyM : null, selected: k.id === selectedId,
    onClick: () => select(k.id),
  })), [kfs, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps
  const trackLine = useMemo(() => track.map((p) => [p.lat, p.lon] as [number, number]), [track]);
  const nearBasemaps = useMemo(() => {
    const k = kfs.find((x) => x.lat != null);
    if (!k) return [];
    return basemaps.filter((b) => k.lat! >= b.south - 0.05 && k.lat! <= b.north + 0.05 && k.lon! >= b.west - 0.05 && k.lon! <= b.east + 0.05);
  }, [kfs, basemaps]);

  if (kfs.length === 0) {
    return <p className="px-4 sm:px-8 py-10 text-ink-2">{a.status === "ready" ? "这个素材没有关键帧。" : "关键帧还在生成。"}</p>;
  }
  const kf = current?.keyframe;
  const an = kf?.meta.analysis;
  const counts = Object.entries(an?.counts ?? {}).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]);
  const attrs = [an?.time_of_day, an?.weather, an?.view, an?.altitude].filter((x) => x && x !== "unknown").map((x) => attrZh[x!] ?? x);

  return (
    <div className="grid gap-6 px-4 sm:px-8 py-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0 space-y-4" aria-label="画面">
        {current ? <FrameViewer keyframe={current.keyframe} detections={current.detections} /> : <div className="aspect-video rounded-[3px] bg-line-soft" />}
        {a.type === "video" && kfs.length > 1 && (
          <FlightStrip keyframes={kfs} duration={a.durationSec ?? 0} selected={selectedId ?? kfs[0].id} onSelect={select} />
        )}
      </section>

      <aside className="space-y-5">
        <section aria-label="位置" className="rounded-[3px] border border-line bg-surface p-4">
          <Coordinates lat={kf?.lat ?? null} lon={kf?.lon ?? null} accuracyM={kf?.geoAccuracyM} source={kf?.geoSource} />
          {(markers.length > 0 || trackLine.length > 1) && (
            <div className="mt-3">
              <GeoMap markers={markers} track={trackLine} basemaps={nearBasemaps} tileUrl={tileUrl} fitKey={`${a.id}`} className="h-56" />
            </div>
          )}
        </section>

        {kf && (
          <section aria-label="画面描述" className="rounded-[3px] border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[17px] font-semibold">画面</h2>
              {a.type === "video" && <span className="figures text-[14px] text-ink-2">{clock(kf.tsSec)}{kf.frameNo != null ? `  第 ${kf.frameNo} 帧` : ""}</span>}
            </div>
            <p className="mt-2 leading-relaxed">{kf.description || "没有描述。"}</p>
            {kf.descriptionSource === "fallback" && <p className="mt-1 text-[13px] text-fail">视觉模型不可用时的本地描述，已标记待重新处理。</p>}
            {attrs.length > 0 && <p className="mt-3 text-[14px] text-ink-2">{attrs.join("，")}</p>}
            {(kf.tags?.length ?? 0) > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {kf.tags!.map((t) => <li key={t} className="rounded-[2px] bg-sunk px-2 py-0.5 text-[13px] text-ink-2">{t}</li>)}
              </ul>
            )}
            {counts.length > 0 && (
              <table className="mt-4 w-full text-[14px]">
                <caption className="pb-1 text-left text-[12px] text-ink-3">目标计数</caption>
                <tbody>
                  {counts.map(([label, n]) => (
                    <tr key={label} className="border-t border-line-soft">
                      <td className="py-1">{labelZh[label] ?? label}</td>
                      <td className="figures py-1 text-right text-[16px]">{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {(an?.landmarks?.length ?? 0) > 0 && <p className="mt-3 text-[14px]"><span className="text-ink-3">地标</span> {an!.landmarks!.join("、")}</p>}
            {(an?.texts?.length ?? 0) > 0 && <p className="mt-1 text-[14px]"><span className="text-ink-3">画面文字</span> {an!.texts!.join("、")}</p>}
            {an?.place_guess?.name && <p className="mt-1 text-[14px]"><span className="text-ink-3">地点推测</span> {an.place_guess.name}（置信度 {an.place_guess.confidence.toFixed(1)}）</p>}
          </section>
        )}
        <p className="text-[12px] text-ink-3">左右方向键切换关键帧。</p>
      </aside>
    </div>
  );
}

function DocumentBody({ a, chunks }: { a: Asset; chunks: number }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setRes(await postJSON<SearchResponse>("/search", { query: q, assetIds: [a.id], groupBy: "unit", topK: 20, noRerank: true }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="max-w-[860px] px-4 sm:px-8 py-6">
      <p className="text-ink-2">已切分为 <span className="figures text-ink">{chunks}</span> 个片段并建立检索索引。</p>
      <form onSubmit={run} className="mt-4 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="在这份文档中查找，例如：夜间飞行"
          className="flex-1 rounded-[3px] border border-line bg-surface px-3 py-2" />
        <Button type="submit" disabled={busy}>{busy ? "查找中" : "查找"}</Button>
      </form>
      {error && <p className="mt-3 text-fail">{error}</p>}
      {res && res.results.length === 0 && <p className="mt-6 text-ink-2">文档中没有找到相关内容。</p>}
      {res && res.results.length > 0 && (
        <ol className="mt-6 space-y-4">
          {res.results.map((r) => (
            <li key={r.unitId} className="border-l-[3px] border-chart/40 pl-4">
              <p className="text-[12px] text-ink-3">{r.page ? `第 ${r.page} 页` : "片段"}</p>
              <p className="max-w-[72ch] leading-relaxed whitespace-pre-line">{r.snippet}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
