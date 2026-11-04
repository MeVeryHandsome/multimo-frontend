import { useEffect, useRef, useState } from "react";
import { api, type Health } from "./api";
import { navigate, useRoute } from "./router";
import Library from "./pages/Library";
import AssetView from "./pages/AssetView";
import Search from "./pages/Search";
import Ask from "./pages/Ask";
import MapPage from "./pages/MapPage";
import Evaluation from "./pages/Evaluation";

const sections = [
  { key: "assets", label: "素材" },
  { key: "search", label: "检索" },
  { key: "ask", label: "问答" },
  { key: "map", label: "地图" },
  { key: "eval", label: "评测" },
] as const;

export default function App() {
  const route = useRoute();
  const [health, setHealth] = useState<Health | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);

  useEffect(() => {
    const load = () => api<Health>("/system/health").then((h) => { setHealth(h); setHealthErr(null); }, (e: Error) => setHealthErr(e.message));
    load();
    const t = window.setInterval(load, 30000);
    return () => window.clearInterval(t);
  }, []);

  const section = route.path[0] ?? "assets";
  let page;
  switch (section) {
    case "search":
      page = <Search params={route.params} />;
      break;
    case "ask":
      page = <Ask params={route.params} />;
      break;
    case "map":
      page = <MapPage params={route.params} />;
      break;
    case "eval":
      page = <Evaluation />;
      break;
    default:
      page = route.path[1] ? <AssetView id={Number(route.path[1])} params={route.params} /> : <Library params={route.params} />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-[1100] border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-[60px] max-w-[1600px] items-center gap-6 px-4 sm:px-8">
          <a href="#/assets" className="flex shrink-0 items-center gap-2.5" aria-label="Multimo 首页">
            <Mark />
            <span className="hidden text-[18px] font-semibold tracking-tight sm:inline">Multimo</span>
          </a>
          <nav aria-label="主导航" className="flex h-full min-w-0 flex-1 items-stretch gap-1 overflow-x-auto sm:gap-2">
            {sections.map((s) => {
              const active = section === s.key;
              return (
                <a key={s.key} href={`#/${s.key}`} aria-current={active ? "page" : undefined}
                  className={`relative flex shrink-0 items-center px-2.5 text-[15px] transition-colors ${active ? "font-semibold text-ink" : "text-ink-2 hover:text-ink"}`}>
                  {s.label}
                  {active && <span className="absolute right-2.5 bottom-0 left-2.5 h-[2px] rounded-full bg-ink" />}
                </a>
              );
            })}
          </nav>
          <QuickSearch />
          <SystemStatus health={health} error={healthErr} />
        </div>
      </header>
      <main className="min-w-0 flex-1">{page}</main>
    </div>
  );
}

// Mark: a camera footprint seen from above, with its centre point.
function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="2.5" y="5.5" width="21" height="15" rx="3" fill="none" stroke="#17202a" strokeWidth="1.8" />
      <path d="M2.5 13h5M18.5 13h5M13 5.5v3M13 17.5v3" stroke="#17202a" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="13" cy="13" r="2.6" fill="#c2185b" />
    </svg>
  );
}

function QuickSearch() {
  const [q, setQ] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) { navigate("/search", { q: q.trim() }); setQ(""); } }}
      className="hidden lg:block">
      <label htmlFor="quick-search" className="sr-only">检索素材和文档</label>
      <input id="quick-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="检索画面、地点或条款"
        className="h-9 w-64 rounded-full border border-line bg-ground px-4 text-[14px] placeholder:text-ink-3 focus:border-line-strong focus:bg-surface focus:outline-none" />
    </form>
  );
}

function SystemStatus({ health, error }: { health: Health | null; error: string | null }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  const ok = health?.status === "ok" && !error;
  const color = error ? "bg-fail" : ok ? "bg-pass" : "bg-[#c98a1e]";
  const title = error ? "后端不可达" : ok ? "服务正常" : "部分配置缺失";
  return (
    <div ref={box} className="relative shrink-0">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-full px-3 text-[13px] text-ink-2 hover:bg-ground">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span className="hidden sm:inline">{title}</span>
      </button>
      {open && (
        <div className="panel float absolute top-11 right-0 z-[1200] w-80 p-5">
          <p className="font-semibold">{title}</p>
          {error && <p className="mt-1 text-[13px] text-fail">{error}</p>}
          {health && (
            <dl className="mt-3 space-y-2 text-[13px]">
              {[
                ["视觉模型", health.models.vlm],
                ["目标检测", health.models.detector || "未配置，由视觉模型画框"],
                ["文本向量", health.models.embedding],
                ["图像向量", health.models.vision],
                ["决策模型", health.models.decision],
                ["数据库", health.database === "up" ? "正常" : "不可用"],
                ["版本", health.version],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="shrink-0 text-ink-3">{k}</dt>
                  <dd className="text-right break-all">{v}</dd>
                </div>
              ))}
              {health.missing.length > 0 && <p className="text-fail">缺少配置：{health.missing.join("、")}</p>}
            </dl>
          )}
          <a href="/swagger" target="_blank" rel="noreferrer" className="mt-4 inline-block text-[13px] text-geo hover:underline">接口文档</a>
        </div>
      )}
    </div>
  );
}
