import { useCallback, useEffect, useRef, useState } from "react";
import { api, query, statusLabel, thumbnailUrl, typeLabel, type Asset, type AssetList, type AssetType, type Stats } from "../api";
import { bytes, dateTime, duration } from "../format";
import { navigate } from "../router";
import { Button, ErrorNote, Loading, Page, PageTitle, Segmented } from "../components/ui";

const PAGE = 48;

export default function Library({ params }: { params: URLSearchParams }) {
  const type = (params.get("type") ?? "") as AssetType | "";
  const collection = params.get("collection") ?? "";
  const keyword = params.get("q") ?? "";
  const page = Number(params.get("page") ?? 1);
  const [data, setData] = useState<AssetList | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kw, setKw] = useState(keyword);

  const set = (patch: Record<string, string | number | undefined>) =>
    navigate("/assets", { type, collection, q: keyword, page: undefined, ...patch }, true);

  const load = useCallback(() => {
    setError(null);
    api<AssetList>(`/assets${query({ type, collection, keyword, page, size: PAGE })}`).then(setData, (e: Error) => setError(e.message));
    api<Stats>("/system/stats").then(setStats, () => {});
  }, [type, collection, keyword, page]);
  useEffect(load, [load]);

  // Keep refreshing while anything is still being processed.
  const busy = data?.list.some((a) => a.status === "pending" || a.status === "processing");
  useEffect(() => {
    if (!busy) return;
    const t = window.setTimeout(load, 5000);
    return () => window.clearTimeout(t);
  }, [busy, load, data]);

  const counts = Object.fromEntries((stats?.assetsByType ?? []).map((r) => [r.key, r.count]));
  const total = (stats?.assetsByType ?? []).reduce((s, r) => s + r.count, 0);
  const typeOptions = [
    { value: "" as const, label: <>全部 <span className="tnum text-ink-3">{total}</span></> },
    ...(["video", "image", "remote_sensing", "document"] as AssetType[]).map((t) => ({
      value: t, label: <>{typeLabel[t]} <span className="tnum text-ink-3">{counts[t] ?? 0}</span></>,
    })),
  ];
  const processing = (stats?.tasksByStatus ?? []).filter((r) => r.key === "pending" || r.key === "running").reduce((s, r) => s + r.count, 0);

  return (
    <Page wide>
      <PageTitle title="素材" aside={<Upload onDone={load} />}>
        {stats
          ? <>共 <span className="tnum">{total}</span> 个素材，<span className="tnum">{stats.keyframes}</span> 个关键帧，<span className="tnum">{stats.docChunks}</span> 个文档片段{processing > 0 && <span className="text-geo">，<span className="tnum">{processing}</span> 项处理任务进行中</span>}。</>
          : "视频、航拍照片、遥感影像和文档。"}
      </PageTitle>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented label="按类型筛选" value={type} options={typeOptions} onChange={(v) => set({ type: v })} />
        <select aria-label="按集合筛选" value={collection} onChange={(e) => set({ collection: e.target.value })}
          className="h-9 rounded-full border border-line bg-surface px-3.5 text-[14px] text-ink-2">
          <option value="">全部集合</option>
          {(stats?.assetsByCollection ?? []).map((c) => (
            <option key={c.key} value={c.key}>{c.key}（{c.count}）</option>
          ))}
        </select>
        <form onSubmit={(e) => { e.preventDefault(); set({ q: kw }); }} className="w-full sm:ml-auto sm:w-auto">
          <input type="search" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="按文件名查找" aria-label="按文件名查找"
            className="h-9 w-full rounded-full border border-line bg-surface px-4 text-[14px] placeholder:text-ink-3 sm:w-60" />
        </form>
      </div>

      {error && <ErrorNote error={error} retry={load} />}
      {!type && !keyword && !collection && stats && total > 0 ? (
        <Overview counts={counts} onMore={(t) => set({ type: t })} />
      ) : (<>
      {!data && !error && <Loading />}
      {data && data.list.length === 0 && (
        <div className="panel px-6 py-16 text-center">
          <p className="text-[17px] font-semibold">{keyword || type || collection ? "没有符合条件的素材" : "还没有素材"}</p>
          <p className="mt-1 text-ink-2">{keyword || type || collection ? "换个条件试试，或清除筛选。" : "上传视频、照片、遥感影像或文档，系统会自动抽取关键帧、识别目标并定位。"}</p>
        </div>
      )}
      {data && data.list.length > 0 && (
        <>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {data.list.map((a) => <Tile key={a.id} a={a} />)}
          </ul>
          <Pager page={page} total={data.total} onPage={(p) => set({ page: p })} />
        </>
      )}
      </>)}
    </Page>
  );
}

// Overview: one row per asset type, newest first, each linking to its full grid.
function Overview({ counts, onMore }: { counts: Record<string, number>; onMore: (t: AssetType) => void }) {
  const types = (["video", "image", "remote_sensing", "document"] as AssetType[]).filter((t) => (counts[t] ?? 0) > 0);
  return (
    <div className="space-y-12">
      {types.map((t) => <OverviewRow key={t} type={t} count={counts[t]} onMore={() => onMore(t)} />)}
    </div>
  );
}

function OverviewRow({ type, count, onMore }: { type: AssetType; count: number; onMore: () => void }) {
  const [list, setList] = useState<Asset[] | null>(null);
  useEffect(() => {
    api<AssetList>(`/assets${query({ type, size: 10 })}`).then((r) => setList(r.list), () => setList([]));
  }, [type]);
  return (
    <section aria-label={typeLabel[type]}>
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <h2 className="text-[19px] font-semibold">{typeLabel[type]} <span className="tnum ml-1 text-[15px] font-normal text-ink-3">{count}</span></h2>
        {count > 10 && <button onClick={onMore} className="text-[14px] text-geo hover:underline">查看全部</button>}
      </div>
      {!list ? <div className="h-40" /> : (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {list.map((a) => <Tile key={a.id} a={a} />)}
        </ul>
      )}
    </section>
  );
}

function Tile({ a }: { a: Asset }) {
  const thumb = a.meta?.thumbnail ? thumbnailUrl(a.id) : null;
  const title = (a.meta?.title as string) || a.filename;
  const located = a.lat != null && a.lon != null;
  const corner = a.type === "video" && a.durationSec ? duration(a.durationSec)
    : a.type === "document" && a.format === "pdf" && a.pageCount ? `${a.pageCount} 页` : null;
  return (
    <li>
      <a href={`#/assets/${a.id}`} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-media)] bg-sunk ring-1 ring-line ring-inset">
          {thumb && a.type !== "document"
            ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
            : <DocCover a={a} />}
          {corner && <span className="tnum absolute right-2 bottom-2 rounded-md bg-stage/75 px-1.5 py-0.5 text-[12px] font-semibold text-white">{corner}</span>}
          {a.status !== "ready" && (
            <span className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[12px] font-semibold ${a.status === "failed" ? "bg-fail text-white" : "bg-surface/90 text-geo"}`}>{statusLabel[a.status]}</span>
          )}
        </div>
        <p className="mt-2.5 truncate text-[15px] font-semibold group-hover:text-geo" title={title}>{title}</p>
        <p className="mt-0.5 flex items-center gap-2 text-[13px] text-ink-3">
          <span>{typeLabel[a.type]}</span>
          <span className="truncate">{a.collection}</span>
          {a.capturedAt && <span className="tnum hidden truncate xl:inline">{dateTime(a.capturedAt).slice(0, 10)}</span>}
          {located && <span className="ml-auto shrink-0 text-geo" title={`${a.lat!.toFixed(5)}, ${a.lon!.toFixed(5)}`}>已定位</span>}
        </p>
      </a>
    </li>
  );
}

// DocCover: a typographic cover for documents (and assets without a thumbnail).
function DocCover({ a }: { a: Asset }) {
  const title = (a.meta?.title as string) || a.filename;
  return (
    <div className="flex h-full flex-col justify-between bg-gradient-to-b from-surface to-sunk p-4">
      <p className="line-clamp-4 text-[15px] leading-snug font-semibold text-ink">{title}</p>
      <p className="text-[12px] text-ink-3">
        <span className="font-semibold text-ink-2">{a.format.toUpperCase()}</span>
        <span className="ml-2 tnum">{bytes(a.sizeBytes)}</span>
      </p>
    </div>
  );
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (pages <= 1) return null;
  return (
    <nav aria-label="分页" className="mt-10 flex items-center justify-center gap-4 text-[14px]">
      <Button kind="quiet" disabled={page <= 1} onClick={() => onPage(page - 1)}>上一页</Button>
      <span className="tnum text-ink-2">第 {page} 页，共 {pages} 页</span>
      <Button kind="quiet" disabled={page >= pages} onClick={() => onPage(page + 1)}>下一页</Button>
    </nav>
  );
}

function Upload({ onDone }: { onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<string | null>(null);
  const [collection, setCollection] = useState("default");

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    let ok = 0;
    const failed: string[] = [];
    for (const [i, f] of [...files].entries()) {
      setState(`正在上传 ${i + 1}/${files.length}：${f.name}`);
      const body = new FormData();
      body.append("file", f);
      body.append("collection", collection || "default");
      try {
        await api("/assets", { method: "POST", body });
        ok++;
      } catch (e) {
        failed.push(`${f.name}：${(e as Error).message}`);
      }
    }
    setState(failed.length ? `已上传 ${ok} 个，失败 ${failed.length} 个：${failed.join("；")}` : `已上传 ${ok} 个，正在处理`);
    if (input.current) input.current.value = "";
    onDone();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state && <span className="max-w-[420px] truncate text-[13px] text-ink-2" title={state}>{state}</span>}
      <label className="flex h-9 items-center rounded-full border border-line bg-surface pl-3.5 text-[13px] text-ink-3">
        集合
        <input value={collection} onChange={(e) => setCollection(e.target.value)}
          className="ml-2 h-full w-24 rounded-r-full bg-transparent pr-3 text-[14px] text-ink focus:outline-none" />
      </label>
      <input ref={input} type="file" multiple hidden onChange={(e) => upload(e.target.files)}
        accept="video/*,image/*,.tif,.tiff,.pdf,.doc,.docx,.txt,.csv,.geojson,.json,.flv,.wmv,.mkv" />
      <Button onClick={() => input.current?.click()}>上传文件</Button>
    </div>
  );
}
