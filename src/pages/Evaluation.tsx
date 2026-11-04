import { useCallback, useEffect, useState } from "react";
import { api, postJSON, type Metric, type RunInfo, type SuiteStatus } from "../api";
import { dateTime } from "../format";
import { Button, ErrorNote, Loading, Page, PageTitle, Verdict } from "../components/ui";

const sectionZh: Record<string, string> = {
  formats: "数据类型", keyframe: "关键帧标注", detection: "目标识别", geo: "空间对齐", retrieval: "检索", qa: "问答",
};

// How each core metric is drawn: its scale, target and which side is good.
type Scale = { max: number; target: number; better: "high" | "low"; unit: "ratio" | "count" | "metres" };
const scales: Record<string, (v: number) => Scale> = {
  data_types: (v) => ({ max: Math.max(6, v), target: 3, better: "high", unit: "count" }),
  keyframe_consistency: () => ({ max: 1, target: 0.4, better: "high", unit: "ratio" }),
  detection_precision: () => ({ max: 1, target: 0.85, better: "high", unit: "ratio" }),
  detection_miss: () => ({ max: 1, target: 0.05, better: "low", unit: "ratio" }),
  geo_visual: (v) => ({ max: Math.max(300, Math.ceil((v * 1.25) / 50) * 50), target: 100, better: "low", unit: "metres" }),
  retrieval_precision: () => ({ max: 1, target: 0.85, better: "high", unit: "ratio" }),
  retrieval_recall: () => ({ max: 1, target: 0.8, better: "high", unit: "ratio" }),
  qa_accuracy: () => ({ max: 1, target: 0.8, better: "high", unit: "ratio" }),
};

export default function Evaluation() {
  const [status, setStatus] = useState<SuiteStatus | null>(null);
  const [runs, setRuns] = useState<RunInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(() => {
    api<SuiteStatus>("/testsuite/status").then(setStatus, (e: Error) => setError(e.message));
    api<{ list: RunInfo[] }>("/testsuite/reports").then((r) => setRuns(r.list ?? []), () => setRuns([]));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!status?.running) return;
    const t = window.setTimeout(load, 3000);
    return () => window.clearTimeout(t);
  }, [status, load]);

  const run = async () => {
    setStarting(true);
    setError(null);
    try {
      setStatus(await postJSON<SuiteStatus>("/testsuite/run", {}));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const last = status?.last ?? runs?.[0];
  const core = last?.metrics.filter((m) => m.primary) ?? [];
  const aux = last?.metrics.filter((m) => !m.primary) ?? [];
  return (
    <Page>
      <PageTitle title="评测"
        aside={<Button onClick={run} disabled={starting || status?.running}>{status?.running ? "评测进行中" : "运行全部评测"}</Button>}>
        用 testdata/benchmark 中的人工标注、GPS 真值和文档原文测量赛题要求的各项指标，标准答案不来自系统自身的输出。
      </PageTitle>
      {error && <ErrorNote error={error} />}
      {status?.running && (
        <div className="mb-6 rounded-[10px] bg-geo-soft px-4 py-3 text-[14px] text-geo">
          正在运行：{progressZh(status.progress)}<span className="ml-3 text-ink-3">开始于 {dateTime(status.startedAt)}</span>
        </div>
      )}
      {status?.error && !status.running && <ErrorNote error={`上次运行失败：${status.error}`} />}
      {!status && !error && <Loading />}

      {last && (
        <>
          <section aria-label="核心指标" className="panel overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-6 py-5">
              <h2 className="text-[20px] font-semibold">
                <span className="tnum">{last.passed}</span> 项达标，<span className="tnum">{last.primary - last.passed}</span> 项未达标
              </h2>
              <p className="text-[14px] text-ink-2">
                <span className="tnum">{dateTime(last.generatedAt)}</span>，用时 <span className="tnum">{Math.round(last.durationSec)}</span> 秒
                <a href={`/api/v1/testsuite/reports/${last.id}/html`} target="_blank" rel="noreferrer" className="ml-4 font-semibold text-geo hover:underline">完整报告</a>
                <a href={`/api/v1/testsuite/reports/${last.id}/json`} target="_blank" rel="noreferrer" className="ml-3 text-geo hover:underline">JSON</a>
              </p>
            </div>
            <ul className="divide-y divide-line">
              {core.map((m) => <CoreRow key={m.id} m={m} />)}
            </ul>
          </section>

          {aux.length > 0 && (
            <section aria-label="参考指标" className="mt-8">
              <h2 className="mb-3 text-[15px] font-semibold">参考指标</h2>
              <ul className="panel divide-y divide-line">
                {aux.map((m) => (
                  <li key={m.id} className="grid gap-x-6 gap-y-1 px-6 py-3 text-[14px] sm:grid-cols-[240px_200px_1fr]">
                    <span>{m.name}</span>
                    <span className="tnum font-semibold">{m.display}</span>
                    <span className="text-[13px] text-ink-3">{m.note}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {runs && runs.length > 1 && (
        <section aria-label="历史" className="mt-10">
          <h2 className="mb-3 text-[15px] font-semibold">历史运行</h2>
          <ul className="panel divide-y divide-line text-[14px]">
            {runs.slice(1, 12).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-6 py-3">
                <span className="tnum w-36">{dateTime(r.generatedAt)}</span>
                <span className="min-w-0 flex-1 truncate text-ink-2">{r.sections.map((s) => sectionZh[s] ?? s).join("、")}</span>
                <span className="tnum">{r.passed}/{r.primary} 达标</span>
                <a href={`/api/v1/testsuite/reports/${r.id}/html`} target="_blank" rel="noreferrer" className="text-geo hover:underline">报告</a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}

function CoreRow({ m }: { m: Metric }) {
  const sc = scales[m.id]?.(m.value);
  return (
    <li className="grid items-center gap-x-6 gap-y-2 px-6 py-5 md:grid-cols-[minmax(180px,240px)_minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="font-semibold">{m.name}</p>
        {m.note && <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ink-3">{m.note}</p>}
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className="tnum text-[22px] leading-none font-semibold">{m.display}</span>
          <span className="text-[13px] text-ink-3">目标 {m.target}</span>
        </div>
        {sc && <Meter value={m.value} scale={sc} pass={m.pass} label={`${m.name} ${m.display}，目标 ${m.target}`} />}
      </div>
      <div className="md:w-20 md:text-right"><Verdict pass={m.pass} /></div>
    </li>
  );
}

// Meter: the fill carries the result (pass/fail colour), the track is a light
// step of the same colour, and a tick marks the target.
function Meter({ value, scale, pass, label }: { value: number; scale: Scale; pass: boolean; label: string }) {
  const pctOf = (x: number) => `${Math.max(0, Math.min(100, (x / scale.max) * 100))}%`;
  const fill = pass ? "bg-pass" : "bg-fail";
  const track = pass ? "bg-pass-track" : "bg-fail-track";
  const end = scale.unit === "ratio" ? "100%" : scale.unit === "metres" ? `${scale.max} m` : `${scale.max}`;
  return (
    <div role="img" aria-label={label} className="mt-2.5">
      <div className={`relative h-2 rounded-full ${track}`}>
        <div className={`absolute inset-y-0 left-0 rounded-full ${fill}`} style={{ width: pctOf(value) }} />
        <div className="absolute -top-1 -bottom-1 w-[2px] rounded-full bg-ink" style={{ left: pctOf(scale.target) }} title="目标" />
      </div>
      <div className="tnum mt-1 flex justify-between text-[11px] text-ink-3">
        <span>0</span>
        <span>{end}</span>
      </div>
    </div>
  );
}

function progressZh(p?: string): string {
  if (!p) return "";
  const m = p.match(/^(retrieval|qa) (\d+)\/(\d+)$/);
  if (m) return `${sectionZh[m[1]]} ${m[2]}/${m[3]}`;
  const r = p.match(/^running (\w+)$/);
  if (r) return sectionZh[r[1]] ?? r[1];
  return p === "starting" ? "准备中" : p === "done" ? "完成" : p;
}
