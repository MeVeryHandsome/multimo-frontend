import { useEffect, useState } from "react";
import { api, type Health } from "./api";
import { useRoute } from "./router";
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
    <div className="flex min-h-screen flex-col sm:flex-row">
      <nav aria-label="主导航" className="sticky top-0 z-[1100] flex h-12 w-full shrink-0 flex-row items-center border-b border-line bg-ink text-white sm:h-screen sm:w-[68px] sm:flex-col sm:border-r sm:border-b-0">
        <a href="#/assets" className="mx-3 block text-center leading-none sm:mx-0 sm:mt-4 sm:mb-6" aria-label="Multimo 首页">
          <span className="figures block text-[22px] font-semibold tracking-tight">M</span>
          <span className="figures hidden text-[10px] text-white/55 sm:block">multimo</span>
        </a>
        <ul className="flex flex-1 flex-row sm:flex-col sm:gap-1">
          {sections.map((s) => {
            const active = section === s.key;
            return (
              <li key={s.key}>
                <a
                  href={`#/${s.key}`}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-12 w-14 items-center justify-center text-[15px] tracking-[0.2em] transition-colors sm:w-[68px] ${
                    active ? "bg-white/10 font-semibold text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  {active && <span className="absolute right-2 bottom-0 left-2 h-[3px] bg-magenta sm:top-2 sm:right-auto sm:bottom-2 sm:left-0 sm:h-auto sm:w-[3px]" />}
                  {s.label}
                </a>
              </li>
            );
          })}
        </ul>
        <SystemDot health={health} error={healthErr} />
      </nav>
      <main className="min-w-0 flex-1">{page}</main>
    </div>
  );
}

function SystemDot({ health, error }: { health: Health | null; error: string | null }) {
  const [open, setOpen] = useState(false);
  const ok = health?.status === "ok" && !error;
  const color = error ? "bg-fail" : ok ? "bg-pass" : "bg-[#d39a2b]";
  const title = error ? `后端不可达：${error}` : ok ? "服务正常" : "部分配置缺失";
  return (
    <div className="relative mr-2 sm:mr-0 sm:mb-4">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={title} title={title}
        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      </button>
      {open && (
        <div className="absolute top-11 right-0 z-[1000] w-72 sm:top-auto sm:right-auto sm:bottom-0 sm:left-[60px] rounded border border-line bg-surface p-4 text-ink shadow-[0_6px_24px_rgba(22,33,44,0.18)]">
          <p className="mb-2 font-semibold">{title}</p>
          {health && (
            <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1 text-[13px]">
              <dt className="text-ink-3">版本</dt><dd>{health.version}</dd>
              <dt className="text-ink-3">数据库</dt><dd>{health.database === "up" ? "正常" : "不可用"}</dd>
              <dt className="text-ink-3">视觉模型</dt><dd className="break-all">{health.models.vlm}</dd>
              <dt className="text-ink-3">目标检测</dt><dd className="break-all">{health.models.detector || "未配置（由视觉模型画框）"}</dd>
              <dt className="text-ink-3">文本向量</dt><dd className="break-all">{health.models.embedding}</dd>
              <dt className="text-ink-3">图像向量</dt><dd className="break-all">{health.models.vision}</dd>
              <dt className="text-ink-3">决策模型</dt><dd className="break-all">{health.models.decision}</dd>
              {health.missing.length > 0 && (<><dt className="text-fail">缺少配置</dt><dd className="text-fail">{health.missing.join("、")}</dd></>)}
            </dl>
          )}
          <a href="/swagger" target="_blank" rel="noreferrer" className="mt-3 inline-block text-[13px] text-chart underline underline-offset-2">接口文档</a>
        </div>
      )}
    </div>
  );
}
