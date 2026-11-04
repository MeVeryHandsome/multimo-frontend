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
import { Button, Chip, ErrorNote, Field, Loading } from "../components/ui";
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

  if (error) return <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-8"><ErrorNote error={error} retry={load} /></div>;
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
  const title = (a.meta?.title as string) || a.filename;
  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-6 pb-5 sm:px-8">
      <nav aria-label="位置" className="text-[13px] text-ink-3">
        <a href="#/assets" className="hover:text-ink">素材</a>
        <span className="mx-2">/</span>
        <a href={`#/assets?collection=${encodeURIComponent(a.collection)}`} className="hover:text-ink">{a.collection}</a>
      </nav>
      <div className="mt-1.5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="min-w-0 truncate text-[26px] leading-tight font-semibold" title={title}>{title}</h1>
        <div className="flex items-center gap-3">
          {a.status !== "ready" && (
            <span className={`text-[14px] ${a.status === "failed" ? "text-fail" : "text-geo"}`}>
              {statusLabel[a.status]}{running ? `：${running.kind}${running.message ? ` ${running.message}` : ""}` : ""}
            </span>
          )}
          <Button kind="quiet" onClick={reprocess} disabled={busy}>{busy ? "已提交" : "重新处理"}</Button>
        </div>
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3 text-[14px]">
        <Field label="类型">{typeLabel[a.type]} {a.format.toUpperCase()}</Field>
        {a.width && a.height ? <Field label="分辨率">{a.width} × {a.height}</Field> : null}
        {a.durationSec ? <Field label="时长">{duration(a.durationSec)}</Field> : null}
        {a.pageCount && a.format === "pdf" ? <Field label="页数">{a.pageCount}</Field> : null}
        {a.capturedAt ? <Field label="拍摄时间">{dateTime(a.capturedAt)}</Field> : null}
        <Field label="大小">{bytes(a.sizeBytes)}</Field>
        {title !== a.filename && <Field label="文件名">{a.filename}</Field>}
      </dl>
      {failed && <ErrorNote error={`${failed.kind} 失败：${failed.error}`} />}
    </div>
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
    return <p className="mx-auto max-w-[1600px] px-4 py-10 text-ink-2 sm:px-8">{a.status === "ready" ? "这个素材没有关键帧。" : "关键帧还在生成。"}</p>;
  }
  const kf = current?.keyframe;
  const an = kf?.meta.analysis;
  const counts = Object.entries(an?.counts ?? {}).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]);
  const attrs = [an?.time_of_day, an?.weather, an?.view, an?.altitude].filter((x) => x && x !== "unknown").map((x) => attrZh[x!] ?? x);
  const maxCount = counts[0]?.[1] ?? 1;

  return (
    <div className="mx-auto grid max-w-[1600px] gap-6 px-4 pb-16 sm:px-8 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section aria-label="画面" className="min-w-0 rounded-[var(--radius-panel)] bg-stage p-4 sm:p-6">
        {current ? <FrameViewer keyframe={current.keyframe} detections={current.detections} /> : <div className="aspect-video rounded-[var(--radius-media)] bg-stage-2" />}
        {a.type === "video" && kfs.length > 1 && (
          <FlightStrip keyframes={kfs} duration={a.durationSec ?? 0} selected={selectedId ?? kfs[0].id} onSelect={select} />
        )}
      </section>

      <aside className="space-y-5">
        <section aria-label="位置" className="panel p-5">
          <h2 className="mb-3 text-[13px] text-ink-3">拍摄位置</h2>
          <Coordinates lat={kf?.lat ?? null} lon={kf?.lon ?? null} accuracyM={kf?.geoAccuracyM} source={kf?.geoSource} />
          {(markers.length > 0 || trackLine.length > 1) && (
            <div className="mt-4 overflow-hidden rounded-[var(--radius-media)]">
              <GeoMap markers={markers} track={trackLine} basemaps={nearBasemaps} tileUrl={tileUrl} fitKey={`${a.id}`} className="h-56" />
            </div>
          )}
        </section>

        {kf && (
          <section aria-label="画面描述" className="panel p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[13px] text-ink-3">画面描述</h2>
              {a.type === "video" && <span className="tnum text-[13px] text-ink-3">{clock(kf.tsSec)}{kf.frameNo != null ? `，第 ${kf.frameNo} 帧` : ""}</span>}
            </div>
            <p className="mt-2 text-[16px] leading-[1.75]">{kf.description || "没有描述。"}</p>
            {kf.descriptionSource === "fallback" && <p className="mt-2 text-[13px] text-fail">视觉模型不可用时的本地描述，已标记待重新处理。</p>}
            {(attrs.length > 0 || (kf.tags?.length ?? 0) > 0) && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {attrs.map((t) => <Chip key={`a-${t}`} tone="geo">{t}</Chip>)}
                {(kf.tags ?? []).filter((t) => !attrs.includes(t)).map((t) => <Chip key={t}>{t}</Chip>)}
              </div>
            )}
            {counts.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 text-[13px] text-ink-3">目标计数</h3>
                <ul className="space-y-1.5">
                  {counts.map(([label, n]) => (
                    <li key={label} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-[14px]">
                      <span className="truncate">{labelZh[label] ?? label}</span>
                      <span className="h-1.5 rounded-full bg-sunk"><span className="block h-1.5 rounded-full bg-magenta/70" style={{ width: `${Math.max(4, (n / maxCount) * 100)}%` }} /></span>
                      <span className="tnum text-right font-semibold">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {((an?.landmarks?.length ?? 0) > 0 || (an?.texts?.length ?? 0) > 0 || an?.place_guess?.name) && (
              <dl className="mt-5 space-y-2 border-t border-line pt-4 text-[14px]">
                {(an?.landmarks?.length ?? 0) > 0 && <div><dt className="text-[12px] text-ink-3">地标</dt><dd>{an!.landmarks!.join("、")}</dd></div>}
                {(an?.texts?.length ?? 0) > 0 && <div><dt className="text-[12px] text-ink-3">画面文字</dt><dd>{an!.texts!.join("、")}</dd></div>}
                {an?.place_guess?.name && <div><dt className="text-[12px] text-ink-3">地点推测</dt><dd>{an.place_guess.name}（置信度 {an.place_guess.confidence.toFixed(1)}）</dd></div>}
              </dl>
            )}
          </section>
        )}
        {kfs.length > 1 && <p className="px-1 text-[12px] text-ink-3">用左右方向键切换关键帧。</p>}
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
    <div className="mx-auto max-w-[920px] px-4 pb-16 sm:px-8">
      <div className="panel p-6">
        <p className="text-ink-2">这份文档已切分为 <span className="tnum font-semibold text-ink">{chunks}</span> 个片段并建立检索索引，可以在其中查找条款。</p>
        <form onSubmit={run} className="mt-4 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="例如：夜间飞行、最大高度、视距内"
            aria-label="在文档中查找" className="h-11 flex-1 rounded-full border border-line-strong bg-surface px-5 focus:border-ink-3 focus:outline-none" />
          <Button type="submit" disabled={busy}>{busy ? "查找中" : "查找"}</Button>
        </form>
        {error && <ErrorNote error={error} />}
      </div>
      {res && res.results.length === 0 && <p className="mt-8 text-center text-ink-2">文档中没有找到相关内容。</p>}
      {res && res.results.length > 0 && (
        <ol className="mt-8 space-y-6">
          {res.results.map((r) => (
            <li key={r.unitId} className="border-l-2 border-geo/40 pl-5">
              <p className="text-[12px] text-ink-3">{r.page ? `第 ${r.page} 页` : "片段"}</p>
              <p className="mt-1 max-w-[70ch] leading-[1.8] whitespace-pre-line">{r.snippet}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
