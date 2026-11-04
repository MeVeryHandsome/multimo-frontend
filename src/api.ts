// Backend responses are wrapped by GoFrame's MiddlewareHandlerResponse.
type Envelope<T> = { code: number; message: string; data: T };

export class ApiError extends Error {
  constructor(message: string, readonly code: number) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, init);
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !body || body.code !== 0) {
    throw new ApiError(body?.message || res.statusText || "请求失败", body?.code ?? res.status);
  }
  return body.data;
}

export function postJSON<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ---------------------------------------------------------------- system

export type Health = {
  status: "ok" | "degraded";
  version: string;
  database: "up" | "down";
  models: { vlm: string; embedding: string; embeddingDim: number; decision: string; vision: string; detector: string };
  missing: string[];
  time: string;
};

export type CountRow = { key: string; count: number };
export type Stats = {
  assetsByType: CountRow[];
  assetsByStatus: CountRow[];
  assetsByCollection: CountRow[];
  tasksByStatus: CountRow[];
  docChunks: number;
  keyframes: number;
};

// ---------------------------------------------------------------- assets

export type AssetType = "video" | "image" | "remote_sensing" | "document";

export type Asset = {
  id: number;
  type: AssetType;
  format: string;
  collection: string;
  filename: string;
  source: string;
  sizeBytes: number;
  status: "pending" | "processing" | "ready" | "failed";
  meta: Record<string, unknown>;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  fps: number | null;
  pageCount: number | null;
  capturedAt: string | null;
  lat: number | null;
  lon: number | null;
  geoSource?: string;
  geoAccuracyM: number | null;
  createdAt: string;
};

export type AssetList = { list: Asset[]; total: number; page: number; size: number };

export const thumbnailUrl = (id: number) => `/api/v1/assets/${id}/thumbnail`;

export type Keyframe = {
  id: number;
  assetId: number;
  idx: number;
  tsSec: number;
  frameNo: number | null;
  width: number;
  height: number;
  description: string;
  descriptionSource: string;
  tags: string[] | null;
  capturedAt: string | null;
  lat: number | null;
  lon: number | null;
  geoSource: string;
  geoAccuracyM: number | null;
  meta: {
    analysis?: {
      counts?: Record<string, number>;
      landmarks?: string[];
      texts?: string[];
      scene?: string[];
      time_of_day?: string;
      weather?: string;
      view?: string;
      altitude?: string;
      box_source?: string;
      detector?: string;
      place_guess?: { name: string; confidence: number };
    };
    [k: string]: unknown;
  };
  detections: number;
  imageUrl: string;
};

export type Detection = {
  id: number;
  label: string;
  labelZh: string;
  score: number | null;
  x: number;
  y: number;
  w: number;
  h: number;
  source: string;
};

export type TrackPoint = { tSec: number; ts: string | null; lat: number; lon: number; altM: number | null };

// ---------------------------------------------------------------- geo

export type GeoPoint = {
  keyframeId: number;
  assetId: number;
  assetType: AssetType;
  collection: string;
  filename: string;
  tsSec: number;
  lat: number;
  lon: number;
  geoSource: string;
  geoAccuracyM: number | null;
  imageUrl: string;
};
export type Basemap = {
  assetId: number;
  filename: string;
  collection: string;
  west: number;
  south: number;
  east: number;
  north: number;
  thumbnailUrl: string;
};
export type GeoOverview = { points: GeoPoint[]; basemaps: Basemap[]; tileUrl: string };

// ---------------------------------------------------------------- search

export type Filters = {
  lat?: number;
  lon?: number;
  radiusM?: number;
  south?: number;
  north?: number;
  west?: number;
  east?: number;
  from?: string;
  to?: string;
  place?: string;
  source?: Record<string, string>;
};

export type SearchResult = {
  kind: "keyframe" | "chunk";
  unitId: number;
  assetId: number;
  assetType: AssetType;
  collection: string;
  filename: string;
  path: string;
  score: number;
  relevant: boolean;
  snippet: string;
  tsSec?: number;
  page?: number;
  lat?: number;
  lon?: number;
  capturedAt?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  signals: {
    bm25Rank?: number;
    textRank?: number;
    imageRank?: number;
    objectRank?: number;
    rrf: number;
    decision?: number;
    spatialDepthM?: number;
  };
};

export type SearchResponse = {
  query: string;
  filters: Filters;
  objects: { labels: string[]; min?: number; absent?: boolean } | null;
  reranked: boolean;
  results: SearchResult[];
  timingsMs: Record<string, number>;
};

// ---------------------------------------------------------------- QA

export type Evidence = {
  n: number;
  kind: "asset" | "keyframe" | "chunk";
  assetId: number;
  unitId?: number;
  filename: string;
  page?: number;
  tsSec?: number;
  text: string;
  imageUrl?: string;
  relevance?: number;
  mentioned?: boolean;
};

export type Answer = {
  question: string;
  answer: string;
  citations: number[];
  confidence: number;
  intent: string;
  mentioned: string[];
  evidence: Evidence[];
  fallback: boolean;
  timingsMs: Record<string, number>;
};

// ---------------------------------------------------------------- testsuite

export type Metric = {
  id: string;
  name: string;
  value: number;
  display: string;
  target: string;
  pass: boolean;
  primary: boolean;
  note?: string;
};

export type RunInfo = {
  id: string;
  generatedAt: string;
  durationSec: number;
  sections: string[];
  passed: number;
  primary: number;
  allPassed: boolean;
  metrics: Metric[];
};

export type SuiteStatus = {
  running: boolean;
  runId?: string;
  sections?: string[];
  progress?: string;
  startedAt?: string;
  error?: string;
  last?: RunInfo;
};

// ---------------------------------------------------------------- labels

export const typeLabel: Record<AssetType, string> = {
  video: "视频",
  image: "图片",
  remote_sensing: "遥感影像",
  document: "文档",
};

export const geoSourceLabel: Record<string, string> = {
  telemetry: "飞行记录插值",
  exif: "照片 EXIF",
  metadata: "登记元数据",
  geotiff: "影像地理参考",
  landmark: "地标推断",
  visual: "底图视觉匹配",
  "visual-track": "底图匹配 + 航迹平滑",
  "visual-refined": "底图匹配 + 航迹平滑 + 局部细化",
};

export const statusLabel: Record<Asset["status"], string> = {
  pending: "排队中",
  processing: "处理中",
  ready: "就绪",
  failed: "失败",
};
