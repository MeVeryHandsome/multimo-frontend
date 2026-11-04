import { useCallback, useEffect, useRef, useState } from "react";
import { api, query, statusLabel, thumbnailUrl, typeLabel, type Asset, type AssetList, type AssetType, type Stats } from "../api";
import { bytes, dateTime, duration } from "../format";
import { navigate } from "../router";
import { Button, ErrorNote, Loading, PageHeader, Segmented } from "../components/ui";

const PAGE = 50;

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
    { value: "" as const, label: <>全部 <span className="figures text-ink-3">{total}</span></> },
    ...(["video", "image", "remote_sensing", "document"] as AssetType[]).map((t) => ({
      value: t, label: <>{typeLabel[t]} <span className="figures text-ink-3">{counts[t] ?? 0}</span></>,
    })),
  ];

  return (
    <div>
      <PageHeader title="素材" aside={<Upload onDone={load} />}>
        视频、航拍照片、遥感影像和文档。处理完成后可以检索、问答，并在地图上查看位置。
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3 border-b border-line-soft bg-surface px-4 sm:px-8 py-3">
        <Segmented label="按类型筛选" value={type} options={typeOptions} onChange={(v) => set({ type: v })} />
        <select aria-label="按集合筛选" value={collection} onChange={(e) => set({ collection: e.target.value })}
          className="rounded-[3px] border border-line bg-surface px-2 py-1.5 text-[14px]">
          <option value="">所有集合</option>
          {(stats?.assetsByCollection ?? []).map((c) => (
            <option key={c.key} value={c.key}>{c.key}（{c.count}）</option>
          ))}
        </select>
        <form onSubmit={(e) => { e.preventDefault(); set({ q: kw }); }} className="w-full sm:ml-auto sm:w-auto">
          <input type="search" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="按文件名查找"
            className="w-full sm:w-56 rounded-[3px] border border-line bg-surface px-3 py-1.5 text-[14px] placeholder:text-ink-3" />
        </form>
      </div>

      {error && <ErrorNote error={error} retry={load} />}
      {!data && !error && <Loading />}
      {data && data.list.length === 0 && (
        <p className="px-4 sm:px-8 py-12 text-ink-2">
          {keyword || type || collection ? "没有符合条件的素材。" : "还没有素材。上传视频、照片或文档开始处理。"}
        </p>
      )}
      {data && data.list.length > 0 && (
        <>
          <table className="w-full border-collapse bg-surface text-[14px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-ink-3">
                <th className="w-[92px] py-2 pl-4 sm:pl-8 font-normal"><span className="sr-only">缩略图</span></th>
                <th className="py-2 font-normal">文件</th>
                <th className="hidden py-2 font-normal md:table-cell">集合</th>
                <th className="hidden py-2 font-normal lg:table-cell">规格</th>
                <th className="hidden py-2 font-normal xl:table-cell">拍摄时间</th>
                <th className="hidden py-2 font-normal md:table-cell">位置</th>
                <th className="py-2 pr-4 sm:pr-8 text-right font-normal">状态</th>
              </tr>
            </thead>
            <tbody>
              {data.list.map((a) => <Row key={a.id} a={a} />)}
            </tbody>
          </table>
          <Pager page={page} total={data.total} onPage={(p) => set({ page: p })} />
        </>
      )}
    </div>
  );
}

function Row({ a }: { a: Asset }) {
  const spec = [
    `${typeLabel[a.type]} ${a.format.toUpperCase()}`,
    a.width && a.height ? `${a.width}×${a.height}` : "",
    a.durationSec ? duration(a.durationSec) : "",
    a.type === "document" && a.pageCount ? `${a.pageCount} 页` : "",
    bytes(a.sizeBytes),
  ].filter(Boolean);
  const thumb = a.meta?.thumbnail ? thumbnailUrl(a.id) : null;
  return (
    <tr onClick={() => navigate(`/assets/${a.id}`)} className="cursor-pointer border-b border-line-soft hover:bg-sunk">
      <td className="py-2 pl-4 sm:pl-8">
        <div className="h-[46px] w-[72px] overflow-hidden rounded-[2px] bg-sunk">
          {thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
            : <span className="flex h-full items-center justify-center text-[12px] text-ink-3">{a.format.toUpperCase()}</span>}
        </div>
      </td>
      <td className="max-w-[340px] py-2 pr-4">
        <a href={`#/assets/${a.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium hover:text-chart">
          {(a.meta?.title as string) || a.filename}
        </a>
        {a.meta?.title ? <span className="block truncate text-[12px] text-ink-3">{a.filename}</span> : null}
      </td>
      <td className="hidden py-2 pr-4 text-ink-2 md:table-cell">{a.collection}</td>
      <td className="hidden py-2 pr-4 text-ink-2 lg:table-cell">
        {spec.map((s, i) => <span key={i} className={`figures ${i ? "ml-2.5 text-ink-3" : ""}`}>{s}</span>)}
      </td>
      <td className="figures hidden py-2 pr-4 text-ink-2 xl:table-cell">{dateTime(a.capturedAt)}</td>
      <td className="hidden py-2 pr-4 md:table-cell">
        {a.lat != null && a.lon != null
          ? <span className="figures text-chart">{a.lat.toFixed(4)}, {a.lon.toFixed(4)}</span>
          : <span className="text-ink-3">{a.type === "document" ? "" : "未知"}</span>}
      </td>
      <td className="py-2 pr-4 sm:pr-8 text-right">
        <span className={a.status === "failed" ? "text-fail" : a.status === "ready" ? "text-ink-2" : "text-chart"}>{statusLabel[a.status]}</span>
      </td>
    </tr>
  );
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (pages <= 1) return <p className="px-4 sm:px-8 py-4 text-[13px] text-ink-3">共 {total} 个</p>;
  return (
    <nav aria-label="分页" className="flex items-center gap-3 px-4 sm:px-8 py-4 text-[14px]">
      <Button kind="quiet" disabled={page <= 1} onClick={() => onPage(page - 1)}>上一页</Button>
      <span className="figures text-ink-2">第 {page} / {pages} 页，共 {total} 个</span>
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
    <div className="flex items-center gap-2">
      {state && <span className="max-w-[420px] truncate text-[13px] text-ink-2" title={state}>{state}</span>}
      <label className="text-[13px] text-ink-3">
        集合
        <input value={collection} onChange={(e) => setCollection(e.target.value)} className="ml-1.5 w-28 rounded-[3px] border border-line px-2 py-1 text-[14px] text-ink" />
      </label>
      <input ref={input} type="file" multiple hidden onChange={(e) => upload(e.target.files)}
        accept="video/*,image/*,.tif,.tiff,.pdf,.doc,.docx,.txt,.csv,.geojson,.json,.flv,.wmv,.mkv" />
      <Button onClick={() => input.current?.click()}>上传文件</Button>
    </div>
  );
}
