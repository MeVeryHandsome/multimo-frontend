import { useEffect, useState } from "react";
import { postJSON, typeLabel, type Filters, type SearchResponse, type SearchResult } from "../api";
import { clock, dateTime, latLonText } from "../format";
import { navigate } from "../router";
import { Button, ErrorNote, Segmented } from "../components/ui";
import { objectZh as labelZh } from "../labels";

const examples = [
  "停满小汽车的停车场或道路（40 辆以上）",
  "以北纬29.7253°、东经115.9748°为中心，半径300米内拍摄的航拍图像",
  "夜间拍摄的道路视频",
  "有游泳池的居民区遥感影像",
  "Part 107 对夜间飞行有什么要求",
];

export default function Search({ params }: { params: URLSearchParams }) {
  const q = params.get("q") ?? "";
  const group = (params.get("group") ?? "asset") as "asset" | "unit";
  const [text, setText] = useState(q);
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setText(q), [q]);
  useEffect(() => {
    if (!q) {
      setRes(null);
      return;
    }
    let live = true;
    setBusy(true);
    setError(null);
    postJSON<SearchResponse>("/search", { query: q, topK: 30, groupBy: group })
      .then((r) => live && setRes(r), (e: Error) => live && setError(e.message))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [q, group]);

  const submit = (s: string) => navigate("/search", { q: s.trim(), group: group === "asset" ? undefined : group });

  return (
    <div>
      <div className="border-b border-line bg-surface px-4 sm:px-8 pt-8 pb-5">
        <form onSubmit={(e) => { e.preventDefault(); submit(text); }} className="flex max-w-[980px] gap-2">
          <label htmlFor="q" className="sr-only">检索内容</label>
          <input id="q" value={text} onChange={(e) => setText(e.target.value)} autoFocus
            placeholder="描述你要找的画面或条款：地点、时间、目标、数量都可以写进来"
            className="flex-1 rounded-[3px] border border-ink-3 bg-surface px-4 py-3 text-[17px] placeholder:text-ink-3 focus:border-ink focus:outline-none" />
          <Button type="submit" disabled={busy || !text.trim()}>{busy ? "检索中" : "检索"}</Button>
        </form>
        {!q && (
          <div className="mt-4 max-w-[980px]">
            <p className="text-[13px] text-ink-3">可以这样问：</p>
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {examples.map((e) => (
                <li key={e}><button onClick={() => submit(e)} className="rounded-[2px] border border-line px-2.5 py-1 text-left text-[14px] text-ink-2 hover:border-ink-3 hover:text-ink">{e}</button></li>
              ))}
            </ul>
          </div>
        )}
        {res && <Understood res={res} />}
      </div>

      {error && <ErrorNote error={error} />}
      {res && (
        <div className="px-4 sm:px-8 py-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] text-ink-2">
              {res.results.length === 0 ? "没有找到符合条件的结果。" : <>找到 <span className="figures text-ink">{res.results.length}</span> 条，标为相关的 <span className="figures text-ink">{res.results.filter((r) => r.relevant).length}</span> 条</>}
              <span className="figures ml-3 text-ink-3">{res.timingsMs?.total ?? 0} ms</span>
            </p>
            <Segmented label="结果粒度" value={group} onChange={(v) => navigate("/search", { q, group: v === "asset" ? undefined : v })}
              options={[{ value: "asset", label: "每个素材一条" }, { value: "unit", label: "全部关键帧和片段" }]} />
          </div>
          <ol className="divide-y divide-line-soft rounded-[3px] border border-line bg-surface">
            {res.results.map((r, i) => <ResultRow key={`${r.kind}${r.unitId}`} r={r} rank={i + 1} />)}
          </ol>
        </div>
      )}
    </div>
  );
}

// Understood shows how the query was read: hard filters and object
// conditions, so a surprising result list can be explained.
function Understood({ res }: { res: SearchResponse }) {
  const f: Filters = res.filters ?? {};
  const items: string[] = [];
  if (f.lat != null && f.lon != null) items.push(`${f.place ? `${f.place}，` : ""}${latLonText(f.lat, f.lon, 4)} 周围 ${f.radiusM && f.radiusM >= 1000 ? `${f.radiusM / 1000} 公里` : `${f.radiusM} 米`}`);
  if (f.south != null || f.north != null) items.push(`纬度 ${f.south?.toFixed(4) ?? "…"}° 到 ${f.north?.toFixed(4) ?? "…"}°`);
  if (f.west != null) items.push(`经度 ${f.west.toFixed(4)}° 以东`);
  if (f.east != null) items.push(`经度 ${f.east.toFixed(4)}° 以西`);
  if (f.from || f.to) items.push(`拍摄时间 ${dateTime(f.from) || "…"} 至 ${dateTime(f.to) || "…"}`);
  if (res.objects?.labels?.length) {
    const names = res.objects.labels.map((l) => labelZh[l] ?? l).join("、");
    items.push(res.objects.absent ? `画面中几乎没有${names}` : `画面中有${names}${res.objects.min ? `，至少 ${res.objects.min} 个` : ""}`);
  }
  if (items.length === 0 && !res.reranked) return null;
  return (
    <div className="mt-4 flex max-w-[980px] flex-wrap items-center gap-2 text-[14px]">
      <span className="text-ink-3">理解为</span>
      {items.map((t) => <span key={t} className="rounded-[2px] bg-chart-wash px-2 py-0.5 text-chart">{t}</span>)}
      {res.reranked && <span className="text-[13px] text-ink-3">前 50 条由决策模型判断相关性</span>}
      {items.length > 0 && !res.reranked && <span className="text-[13px] text-ink-3">按条件过滤，定位误差范围内的结果排在后面</span>}
    </div>
  );
}

function ResultRow({ r, rank }: { r: SearchResult; rank: number }) {
  const link = r.kind === "keyframe" ? `#/assets/${r.assetId}?kf=${r.unitId}` : `#/assets/${r.assetId}`;
  const where = r.kind === "chunk"
    ? (r.page ? `第 ${r.page} 页` : "文档片段")
    : r.assetType === "video" && r.tsSec != null ? clock(r.tsSec) : "";
  const outside = r.signals.spatialDepthM != null && r.signals.spatialDepthM < 0;
  return (
    <li className="flex gap-4 px-4 py-3 hover:bg-sunk">
      <span className="figures w-6 shrink-0 pt-0.5 text-right text-[15px] text-ink-3">{rank}</span>
      <a href={link} className="block h-[68px] w-[120px] shrink-0 overflow-hidden rounded-[2px] bg-sunk">
        {r.imageUrl
          ? <img src={r.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          : <span className="flex h-full items-center justify-center px-2 text-center text-[12px] text-ink-3">{r.filename.split(".").pop()?.toUpperCase()}</span>}
      </a>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-3">
          <a href={link} className="truncate font-medium hover:text-chart">{r.filename}</a>
          <span className="text-[13px] text-ink-3">{typeLabel[r.assetType]}</span>
          {where && <span className="figures text-[13px] text-ink-3">{where}</span>}
          {r.relevant && <span className="rounded-[2px] bg-magenta-wash px-1.5 text-[12px] text-magenta">相关</span>}
          {outside && <span className="text-[12px] text-ink-3">在范围外 {Math.round(-r.signals.spatialDepthM!)} 米，定位误差内</span>}
        </p>
        <p className="mt-1 line-clamp-2 max-w-[90ch] text-[14px] text-ink-2">{r.snippet}</p>
      </div>
      <div className="w-20 shrink-0 text-right" title={signalText(r.signals)}>
        <span className="figures text-[17px]">{r.score.toFixed(2)}</span>
        <span className="mt-1 block h-1 rounded-full bg-line-soft"><span className="block h-1 rounded-full bg-ink-2" style={{ width: `${Math.min(100, r.score * 100)}%` }} /></span>
      </div>
    </li>
  );
}

// signalText lists where a result ranked in each retriever (shown on hover).
function signalText(s: SearchResult["signals"]): string {
  const parts = [
    s.bm25Rank && `关键词第 ${s.bm25Rank} 名`,
    s.textRank && `语义第 ${s.textRank} 名`,
    s.imageRank && `以文搜图第 ${s.imageRank} 名`,
    s.objectRank && `目标计数第 ${s.objectRank} 名`,
    s.decision != null && `决策模型相关概率 ${s.decision.toFixed(2)}`,
  ].filter(Boolean) as string[];
  return parts.join("\n");
}
