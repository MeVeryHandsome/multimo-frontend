import { Fragment, useEffect, useState, type ReactNode } from "react";
import { postJSON, type Answer, type Evidence } from "../api";
import { clock } from "../format";
import { navigate } from "../router";
import { Button, ErrorNote } from "../components/ui";

const examples = [
  "视频 uav0000086_00000_v 中主要有哪些目标？",
  "航拍图像 01_0101.JPG 是在什么位置拍摄的？给出经纬度。",
  "Palos Verdes 那段飞行的最高高度是多少？是否超过美国 Part 107 的限制？",
  "《无人驾驶航空器飞行管理暂行条例》对微型无人机的重量是怎么规定的？",
];

const intentZh: Record<string, string> = {
  document: "法规文档", visual: "画面内容", location: "位置", metadata: "拍摄参数", cross: "跨来源",
};

export default function Ask({ params }: { params: URLSearchParams }) {
  const q = params.get("q") ?? "";
  const [text, setText] = useState(q);
  const [res, setRes] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(0);

  useEffect(() => setText(q), [q]);
  useEffect(() => {
    if (!q) {
      setRes(null);
      return;
    }
    let live = true;
    setBusy(true);
    setError(null);
    setRes(null);
    setStarted(Date.now());
    postJSON<Answer>("/qa", { question: q })
      .then((r) => live && setRes(r), (e: Error) => live && setError(e.message))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [q]);

  const submit = (s: string) => navigate("/ask", { q: s.trim() });

  return (
    <div>
      <div className="border-b border-line bg-surface px-4 sm:px-8 pt-8 pb-5">
        <form onSubmit={(e) => { e.preventDefault(); submit(text); }} className="flex max-w-[980px] items-start gap-2">
          <label htmlFor="question" className="sr-only">问题</label>
          <textarea id="question" value={text} onChange={(e) => setText(e.target.value)} rows={2} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(text); } }}
            placeholder="就素材或法规提问。点名文件（如 P6519、01_0101.JPG）会优先使用它们作为证据。"
            className="flex-1 resize-y rounded-[3px] border border-ink-3 bg-surface px-4 py-3 text-[17px] placeholder:text-ink-3 focus:border-ink focus:outline-none" />
          <Button type="submit" disabled={busy || !text.trim()}>{busy ? "回答中" : "提问"}</Button>
        </form>
        {!q && (
          <div className="mt-4 max-w-[980px]">
            <p className="text-[13px] text-ink-3">例如：</p>
            <ul className="mt-1.5 flex flex-col items-start gap-1.5">
              {examples.map((e) => (
                <li key={e}><button onClick={() => submit(e)} className="text-left text-[15px] text-chart hover:underline">{e}</button></li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {busy && <Waiting since={started} />}
      {error && <ErrorNote error={error} retry={() => submit(q)} />}
      {res && <AnswerView res={res} />}
    </div>
  );
}

function Waiting({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);
  const s = Math.floor((now - since) / 1000);
  const step = s < 3 ? "判断问题类型" : s < 6 ? "检索证据" : s < 9 ? "筛选有用的证据" : "根据证据作答";
  return <p className="px-4 sm:px-8 py-8 text-ink-2">{step}… <span className="figures text-ink-3">{s} 秒</span></p>;
}

function AnswerView({ res }: { res: Answer }) {
  const cited = new Set(res.citations ?? []);
  return (
    <div className="grid gap-8 px-4 sm:px-8 py-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <article className="max-w-[72ch]">
        <p className="mb-3 flex flex-wrap gap-x-4 text-[13px] text-ink-3">
          <span>问题类型：{intentZh[res.intent] ?? res.intent}</span>
          <span>置信度 <span className="figures">{res.confidence.toFixed(2)}</span></span>
          {res.mentioned?.length > 0 && <span>点名素材：{res.mentioned.join("、")}</span>}
          <span className="figures">{((res.timingsMs?.total ?? 0) / 1000).toFixed(1)} 秒</span>
        </p>
        {res.fallback && <p className="mb-3 border-l-[3px] border-fail bg-fail-wash px-3 py-2 text-[14px]">视觉模型暂时不可用，下面是最相关证据的原文。</p>}
        <div className="text-[17px] leading-[1.8] whitespace-pre-line">{withCitations(res.answer)}</div>
      </article>
      <aside aria-label="证据">
        <h2 className="mb-2 text-[17px] font-semibold">证据</h2>
        <ol className="space-y-3">
          {res.evidence.map((e) => <EvidenceItem key={e.n} e={e} cited={cited.has(e.n)} />)}
        </ol>
      </aside>
    </div>
  );
}

// withCitations turns "[1, 3]" markers into links to the evidence list.
function withCitations(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[(\d+(?:\s*[,，、]\s*\d+)*)\]/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const adjacent = out.length > 0 && m.index === last; // "[2][3]" reads as "2,3"
    out.push(text.slice(last, m.index));
    const ns = m[1].split(/\s*[,，、]\s*/);
    out.push(
      <sup key={m.index} className="figures ml-0.5 text-[12px]">
        {adjacent && ","}
        {ns.map((n, i) => (
          <Fragment key={n}>
            {i > 0 && ","}
            <a href={`#ev-${n}`} onClick={(e) => { e.preventDefault(); document.getElementById(`ev-${n}`)?.scrollIntoView({ block: "center" }); }}
              className="text-magenta hover:underline">{n}</a>
          </Fragment>
        ))}
      </sup>,
    );
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

function EvidenceItem({ e, cited }: { e: Evidence; cited: boolean }) {
  const link = e.kind === "keyframe" ? `#/assets/${e.assetId}?kf=${e.unitId}` : `#/assets/${e.assetId}`;
  const where = e.page != null ? `第 ${e.page} 页` : e.tsSec != null ? clock(e.tsSec) : e.kind === "asset" ? "素材概况" : "";
  return (
    <li id={`ev-${e.n}`} className={`flex gap-3 rounded-[3px] border p-3 ${cited ? "border-magenta/40 bg-surface" : "border-line-soft bg-surface/60"}`}>
      <span className={`figures w-5 shrink-0 text-right text-[16px] ${cited ? "text-magenta" : "text-ink-3"}`}>{e.n}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2 text-[13px]">
          <a href={link} className="truncate font-medium text-ink hover:text-chart">{e.filename}</a>
          {where && <span className="figures shrink-0 text-ink-3">{where}</span>}
        </p>
        {e.imageUrl && <img src={e.imageUrl} alt="" loading="lazy" className="mt-2 aspect-video w-full rounded-[2px] object-cover" />}
        <p className="mt-1.5 line-clamp-5 text-[13px] leading-relaxed text-ink-2">{e.text}</p>
      </div>
    </li>
  );
}
