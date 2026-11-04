import { useEffect, useRef } from "react";
import L from "leaflet";
import { api, type Basemap, type GeoOverview } from "../api";

let overview: Promise<GeoOverview> | null = null;

// geoOverview is fetched once per page load: it carries the tile template
// and the georeferenced basemaps every map overlays.
export function geoOverview(): Promise<GeoOverview> {
  if (!overview) overview = api<GeoOverview>("/geo/overview").catch((e) => { overview = null; throw e; });
  return overview;
}

export type MapMarker = {
  lat: number;
  lon: number;
  accuracyM?: number | null;
  color?: string;
  selected?: boolean;
  popup?: string;
  onClick?: () => void;
};

// GeoMap is a thin Leaflet wrapper: optional online tiles, basemap overview
// images at their georeferenced bounds, markers with accuracy rings and a
// track polyline. It refits only when `fitKey` changes.
export default function GeoMap({ markers, track, basemaps, tileUrl, fitKey, className = "h-64" }: {
  markers: MapMarker[];
  track?: [number, number][];
  basemaps?: Basemap[];
  tileUrl?: string;
  fitKey?: string;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const base = useRef<L.LayerGroup | null>(null);
  const fitted = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([30, 115], 3);
    base.current = L.layerGroup().addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
      fitted.current = undefined; // a remounted map must fit again
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const b = base.current;
    if (!m || !b) return;
    b.clearLayers();
    if (tileUrl) {
      L.tileLayer(tileUrl, { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(b);
    }
    for (const bm of basemaps ?? []) {
      L.imageOverlay(bm.thumbnailUrl, [[bm.south, bm.west], [bm.north, bm.east]], { opacity: 0.95 }).addTo(b);
      L.rectangle([[bm.south, bm.west], [bm.north, bm.east]], { color: "#2a62a3", weight: 1, fill: false, dashArray: "4 4" }).addTo(b);
    }
  }, [tileUrl, basemaps]);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    if (track && track.length > 1) {
      L.polyline(track, { color: "#2a62a3", weight: 2.5, opacity: 0.9 }).addTo(g);
    }
    const pts: L.LatLngExpression[] = [];
    for (const mk of markers) {
      const color = mk.color ?? "#b01f68";
      if (mk.accuracyM && mk.accuracyM > 20 && mk.accuracyM < 5000) {
        L.circle([mk.lat, mk.lon], { radius: mk.accuracyM, color, weight: 1, opacity: 0.6, fillOpacity: mk.selected ? 0.12 : 0.05 }).addTo(g);
      }
      const c = L.circleMarker([mk.lat, mk.lon], {
        radius: mk.selected ? 7 : 4.5, color: mk.selected ? "#16212c" : "#ffffff", weight: mk.selected ? 2 : 1,
        fillColor: color, fillOpacity: 1,
      }).addTo(g);
      if (mk.popup) c.bindPopup(mk.popup);
      if (mk.onClick) c.on("click", mk.onClick);
      pts.push([mk.lat, mk.lon]);
    }
    if (fitKey !== fitted.current) {
      fitted.current = fitKey;
      const all = [...pts, ...(track ?? [])];
      if (all.length === 1) m.setView(all[0], 15);
      else if (all.length > 1) m.fitBounds(L.latLngBounds(all).pad(0.15), { maxZoom: 16 });
      else if (basemaps?.length) m.fitBounds([[basemaps[0].south, basemaps[0].west], [basemaps[0].north, basemaps[0].east]]);
    }
  }, [markers, track, fitKey, basemaps]);

  return <div ref={el} className={`${className} w-full rounded-[3px] border border-line`} />;
}
