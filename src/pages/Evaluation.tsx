import { useCallback, useEffect, useState } from "react";
import { api, postJSON, type RunInfo, type SuiteStatus } from "../api";
import { dateTime } from "../format";
import { Button, ErrorNote, Loading, PageHeader, Verdict } from "../components/ui";

const sectionZh: Record<string, string> = {
  formats: "数据类型", keyframe: "关键帧标注", detection: "目标识别", geo: "空间对齐", retrieval: "检索", qa: "问答",
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
  return (
    <div>
      <PageHeader title="评测"
        aside={<Button onClick={run} disabled={starting || status?.running}>{status?.running ? "评测进行中" : "运行全部评测"}</Button>}>
        按 testdata/benchmark 中的人工标注、GPS 真值和文档原文，测量赛题要求的各项指标。
      </PageHeader>
      {error && <ErrorNote error={error} />}
      {status?.running && (
        <p className="border-b border-line-soft bg-chart-wash px-4 sm:px-8 py-2.5 text-[14px] text-chart">
          正在运行：{progressZh(status.progress)}
          <span className="ml-3 text-ink-3">开始于 {dateTime(status.startedAt)}</span>
        </p>
      )}
      {status?.error && !status.running && <ErrorNote error={`上次运行失败：${status.error}`} />}
      {!status && !error && <Loading />}

      {last && (
        <section className="px-4 sm:px-8 py-6" aria-label="最近一次结果">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[19px] font-semibold">
              最近一次：<span className="figures">{last.passed}/{last.primary}</span> 项核心指标达标
            </h2>
            <p className="text-[14px] text-ink-2">
              {dateTime(last.generatedAt)}，用时 <span className="figures">{Math.round(last.durationSec)}</span> 秒
              <a href={`/api/v1/testsuite/reports/${last.id}/html`} target="_blank" rel="noreferrer" className="ml-4 text-chart underline underline-offset-2">完整报告</a>
              <a href={`/api/v1/testsuite/reports/${last.id}/json`} target="_blank" rel="noreferrer" className="ml-3 text-chart underline underline-offset-2">JSON</a>
            </p>
          </div>
          <table className="mt-4 w-full border-collapse rounded-[3px] bg-surface text-[14px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-ink-3">
                <th className="py-2 pl-4 font-normal">指标</th>
                <th className="py-2 text-right font-normal">结果</th>
                <th className="py-2 pl-6 font-normal">目标</th>
                <th className="py-2 font-normal">结论</th>
                <th className="py-2 pr-4 font-normal">说明</th>
              </tr>
            </thead>
            <tbody>
              {last.metrics.map((m) => (
                <tr key={m.id} className={`border-b border-line-soft ${m.primary ? "" : "text-ink-2"}`}>
                  <td className={`py-2.5 pl-4 ${m.primary ? "font-semibold" : ""}`}>{m.name}</td>
                  <td className="figures py-2.5 text-right text-[17px]">{m.display}</td>
                  <td className="py-2.5 pl-6">{m.target}</td>
                  <td className="py-2.5"><Verdict pass={m.pass} primary={m.primary} /></td>
                  <td className="py-2.5 pr-4 text-[13px] text-ink-3">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {runs && runs.length > 1 && (
        <section className="px-4 sm:px-8 pb-10" aria-label="历史">
          <h2 className="mb-2 text-[17px] font-semibold">历史运行</h2>
          <ul className="divide-y divide-line-soft rounded-[3px] border border-line bg-surface text-[14px]">
            {runs.slice(1).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2">
                <span className="figures w-36">{dateTime(r.generatedAt)}</span>
                <span className="w-56 text-ink-2">{r.sections.map((s) => sectionZh[s] ?? s).join("、")}</span>
                <span className="figures">{r.passed}/{r.primary} 达标</span>
                <a href={`/api/v1/testsuite/reports/${r.id}/html`} target="_blank" rel="noreferrer" className="ml-auto text-chart underline underline-offset-2">报告</a>
              </li>
            ))}
          </ul>
        </section>
      )}
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
