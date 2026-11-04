import { Fragment, useEffect, useState, type ReactNode } from "react";
import { postJSON, type Answer, type Evidence } from "../api";
import { clock } from "../format";
import { navigate } from "../router";
import { Button, Chip, ErrorNote } from "../components/ui";

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

  const submit = (s: string) => s.trim() && navigate("/ask", { q: s.trim() });

  const form = (
    <form onSubmit={(e) => { e.preventDefault(); submit(text); }} className="panel flex items-end gap-3 p-3 shadow-[0_1px_2px_rgba(15,23,32,0.05)]">
      <label htmlFor="question" className="sr-only">问题</label>
      <textarea id="question" value={text} onChange={(e) => setText(e.target.value)} rows={2} autoFocus={!q}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(text); } }}
        placeholder="就素材或法规提问。点名文件（如 P6519、01_0101.JPG）会优先用它们作证据。"
        className="min-h-[52px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[16px] leading-relaxed placeholder:text-ink-3 focus:outline-none" />
      <Button type="submit" disabled={busy || !text.trim()}>{busy ? "回答中" : "提问"}</Button>
    </form>
  );

  if (!q) {
    return (
      <div className="mx-auto max-w-[760px] px-4 pt-[12vh] pb-16 sm:px-8">
        <h1 className="text-center text-[30px] font-semibold">基于证据的问答</h1>
        <p className="mx-auto mt-2 max-w-[56ch] text-center text-ink-2">
          先检索相关的关键帧、飞行记录和法规条款，再由视觉模型根据这些证据作答，每句话都标出出处。
        </p>
        <div className="mt-8">{form}</div>
        <ul className="mt-6 space-y-2">
          {examples.map((e) => (
            <li key={e}>
              <button onClick={() => submit(e)} className="w-full rounded-[10px] px-4 py-2.5 text-left text-[15px] text-ink-2 hover:bg-surface hover:text-ink">{e}</button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-6 pb-16 sm:px-8">
      <div className="max-w-[860px]">{form}</div>
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
  const steps = ["判断问题类型", "检索证据", "筛选有用的证据", "根据证据作答"];
  const cur = s < 2 ? 0 : s < 4 ? 1 : s < 6 ? 2 : 3;
  return (
    <ol className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[14px]" aria-live="polite">
      {steps.map((t, i) => (
        <li key={t} className={i < cur ? "text-ink-3" : i === cur ? "font-semibold text-ink" : "text-ink-3/60"}>
          {t}{i === cur && <span className="tnum ml-1.5 font-normal text-ink-3">{s} 秒</span>}
        </li>
      ))}
    </ol>
  );
}

function AnswerView({ res }: { res: Answer }) {
  const cited = new Set(res.citations ?? []);
  return (
    <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
      <article className="panel self-start p-6 sm:p-8">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
          <Chip tone="geo">{intentZh[res.intent] ?? res.intent}</Chip>
          {res.mentioned?.map((m) => <Chip key={m}>{m}</Chip>)}
          <span className="ml-auto tnum">置信度 {res.confidence.toFixed(2)}，用时 {((res.timingsMs?.total ?? 0) / 1000).toFixed(1)} 秒</span>
        </div>
        {res.fallback && <ErrorNote error="视觉模型暂时不可用，下面是最相关证据的原文。" />}
        <div className="max-w-[68ch] text-[17px] leading-[1.9] whitespace-pre-line">{withCitations(res.answer)}</div>
      </article>
      <aside aria-label="证据">
        <h2 className="mb-3 text-[15px] font-semibold">证据 <span className="tnum font-normal text-ink-3">{res.evidence.length}</span></h2>
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
    out.push(text.slice(last, m.index));
    const ns = m[1].split(/\s*[,，、]\s*/);
    out.push(
      <Fragment key={m.index}>
        {ns.map((n) => (
          <a key={n} href={`#ev-${n}`} onClick={(e) => { e.preventDefault(); document.getElementById(`ev-${n}`)?.scrollIntoView({ block: "center", behavior: "smooth" }); }}
            className="tnum mx-[1px] inline-flex h-[18px] min-w-[18px] -translate-y-[2px] items-center justify-center rounded-full bg-magenta-soft px-1 align-middle text-[11px] font-semibold text-magenta hover:bg-magenta hover:text-white">
            {n}
          </a>
        ))}
      </Fragment>,
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
    <li id={`ev-${e.n}`} className={`panel scroll-mt-24 overflow-hidden ${cited ? "" : "opacity-70"}`}>
      {e.imageUrl && <img src={e.imageUrl} alt="" loading="lazy" className="aspect-[16/8] w-full object-cover" />}
      <div className="p-4">
        <p className="flex items-center gap-2 text-[13px]">
          <span className={`tnum inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold ${cited ? "bg-magenta text-white" : "bg-sunk text-ink-3"}`}>{e.n}</span>
          <a href={link} className="truncate font-semibold text-ink hover:text-geo">{e.filename}</a>
          {where && <span className="tnum ml-auto shrink-0 text-ink-3">{where}</span>}
        </p>
        <p className="mt-2 line-clamp-4 text-[13px] leading-relaxed text-ink-2">{e.text}</p>
      </div>
    </li>
  );
}
