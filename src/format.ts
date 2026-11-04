// Formatting helpers shared by the views.

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function duration(sec: number): string {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const pad = (x: number) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m % 60)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

export function clock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

// dms renders a coordinate the way charts label it: 29°44′36.2″.
export function dms(value: number): { deg: number; min: number; sec: string } {
  const a = Math.abs(value);
  const deg = Math.floor(a);
  const minF = (a - deg) * 60;
  const min = Math.floor(minF);
  const sec = ((minF - min) * 60).toFixed(1);
  return { deg, min, sec };
}

export function hemisphere(lat: number, lon: number): [string, string] {
  return [lat >= 0 ? "N" : "S", lon >= 0 ? "E" : "W"];
}

export function latLonText(lat: number, lon: number, digits = 5): string {
  const [ns, ew] = hemisphere(lat, lon);
  const nsZh = ns === "N" ? "北纬" : "南纬";
  const ewZh = ew === "E" ? "东经" : "西经";
  return `${nsZh} ${Math.abs(lat).toFixed(digits)}°，${ewZh} ${Math.abs(lon).toFixed(digits)}°`;
}

export function dateTime(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(s.includes("T") || s.endsWith("Z") ? s : s.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return s;
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}
