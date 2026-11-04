import { useEffect, useState } from "react";

// A small hash router: the app is served as static files behind nginx and
// every view is addressable (#/assets/12?kf=3) without server rewrites.

export type Route = { path: string[]; params: URLSearchParams };

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/assets";
  const [p, q = ""] = raw.split("?");
  return { path: p.split("/").filter(Boolean), params: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function href(path: string, params?: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return `#${path}${s ? `?${s}` : ""}`;
}

export function navigate(path: string, params?: Record<string, string | number | undefined>, replace = false) {
  const h = href(path, params);
  if (replace) window.history.replaceState(null, "", h);
  else window.location.hash = h.slice(1);
  if (replace) window.dispatchEvent(new HashChangeEvent("hashchange"));
}
