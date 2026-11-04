import { useEffect, useState } from "react";
import { postJSON, typeLabel, type Filters, type SearchResponse, type SearchResult } from "../api";
import { clock, dateTime, latLonText } from "../format";
import { navigate } from "../router";
import { Button, Chip, ErrorNote, Segmented } from "../components/ui";
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

  const submit = (s: string) => s.trim() && navigate("/search", { q: s.trim(), group: group === "asset" ? undefined : group });

  const form = (
    <form onSubmit={(e) => { e.preventDefault(); submit(text); }} className="flex w-full gap-2">
      <label htmlFor="q" className="sr-only">检索内容</label>
      <input id="q" value={text} onChange={(e) => setText(e.target.value)} autoFocus={!q}
        placeholder="描述要找的画面或条款，地点、时间、目标和数量都可以写"
        className="h-12 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-6 text-[16px] shadow-[0_1px_2px_rgba(15,23,32,0.05)] placeholder:text-ink-3 focus:border-ink-3 focus:outline-none" />
      <Button type="submit" size="lg" disabled={busy || !text.trim()}>{busy ? "检索中" : "检索"}</Button>
    </form>
  );

  if (!q) {
    return (
      <div className="mx-auto max-w-[760px] px-4 pt-[12vh] pb-16 sm:px-8">
        <h1 className="text-center text-[30px] font-semibold">检索画面与文档</h1>
        <p className="mx-auto mt-2 max-w-[56ch] text-center text-ink-2">
          关键词、语义、以文搜图和目标计数一起检索，坐标、范围和时间会自动识别为过滤条件。
        </p>
        <div className="mt-8">{form}</div>
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {examples.map((e) => (
            <li key={e}>
              <button onClick={() => submit(e)} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-left text-[14px] text-ink-2 hover:border-line-strong hover:text-ink">{e}</button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-6 pb-16 sm:px-8">
      <div className="max-w-[900px]">{form}</div>
      {res && <Understood res={res} />}
      {error && <ErrorNote error={error} />}
      {busy && !res && <p className="py-16 text-center text-ink-3">检索中…</p>}
      {res && (
        <>
          <div className="mt-8 mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] text-ink-2">
              {res.results.length === 0 ? "没有找到符合条件的结果。" : <>共 <span className="tnum font-semibold text-ink">{res.results.length}</span> 条，其中 <span className="tnum font-semibold text-ink">{res.results.filter((r) => r.relevant).length}</span> 条判为相关</>}
              {res.timingsMs?.total != null && <span className="tnum ml-3 text-ink-3">{(res.timingsMs.total / 1000).toFixed(1)} 秒</span>}
            </p>
            <Segmented label="结果粒度" value={group} onChange={(v) => navigate("/search", { q, group: v === "asset" ? undefined : v })}
              options={[{ value: "asset", label: "每个素材一条" }, { value: "unit", label: "全部关键帧和片段" }]} />
          </div>
          <ol className="panel divide-y divide-line overflow-hidden">
            {res.results.map((r, i) => <ResultRow key={`${r.kind}${r.unitId}`} r={r} rank={i + 1} />)}
          </ol>
        </>
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
    items.push(res.objects.absent ? `几乎没有${names}` : `有${names}${res.objects.min ? `，至少 ${res.objects.min} 个` : ""}`);
  }
  if (items.length === 0 && !res.reranked) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-[14px]">
      <span className="text-ink-3">理解为</span>
      {items.map((t) => <Chip key={t} tone="geo">{t}</Chip>)}
      <span className="text-[13px] text-ink-3">
        {res.reranked ? "前 50 条由决策模型判断相关性" : "按条件过滤，定位误差范围内的结果排在后面"}
      </span>
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
    <li>
      <a href={link} className="group flex gap-5 px-5 py-4 hover:bg-ground">
        <span className="tnum w-5 shrink-0 pt-1 text-right text-[14px] text-ink-3">{rank}</span>
        <div className="h-[92px] w-[148px] shrink-0 overflow-hidden rounded-[var(--radius-media)] bg-sunk">
          {r.imageUrl
            ? <img src={r.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            : <div className="flex h-full flex-col justify-end p-3"><span className="text-[12px] font-semibold text-ink-2">{r.filename.split(".").pop()?.toUpperCase()}</span></div>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="truncate text-[16px] font-semibold group-hover:text-geo">{r.filename}</span>
            <span className="text-[13px] text-ink-3">{typeLabel[r.assetType]}{where && <span className="tnum ml-2">{where}</span>}</span>
            {r.relevant && <Chip tone="magenta">相关</Chip>}
            {outside && <span className="text-[12px] text-ink-3">在范围外 {Math.round(-r.signals.spatialDepthM!)} 米，属定位误差内</span>}
          </p>
          <p className="mt-1.5 line-clamp-2 max-w-[90ch] text-[14px] leading-relaxed text-ink-2">{r.snippet}</p>
        </div>
        <div className="hidden w-16 shrink-0 pt-1 text-right sm:block" title={signalText(r.signals)}>
          <span className="tnum text-[15px] font-semibold">{r.score.toFixed(2)}</span>
          <span className="mt-1.5 block h-1 rounded-full bg-sunk"><span className="block h-1 rounded-full bg-ink-3" style={{ width: `${Math.min(100, r.score * 100)}%` }} /></span>
        </div>
      </a>
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
