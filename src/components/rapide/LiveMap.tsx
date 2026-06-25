import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export type LatLng = { lat: number; lng: number };
export type RiderPin = { lat: number; lng: number; id?: string };
export type OrderRoute = { id: string; pickup: LatLng; dropoff: LatLng };

type Props = {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  rider?: LatLng | null;
  riders?: RiderPin[];
  activeOrders?: OrderRoute[];
  height?: number;
  showRoute?: boolean;
  routeCoords?: LatLng[];
  showGeolocate?: boolean;
  showHeatmap?: boolean;
  zoom?: number;
  className?: string;
  onMapClick?: (latlng: LatLng) => void;
};

/**
 * LiveMap — uses raw mapbox-gl directly (NOT react-map-gl) to avoid
 * React reconciliation loops that freeze the browser.
 *
 * The previous implementation used react-map-gl which wraps the map in
 * React state. Any prop change would re-render the React tree, which
 * triggered mapbox resize observers, which triggered React re-renders,
 * creating an infinite loop. This version manages the map imperatively
 * via refs, completely outside the React render cycle.
 */
export function LiveMap({
  pickup,
  dropoff,
  rider,
  riders,
  activeOrders,
  height = 260,
  showRoute = false,
  routeCoords,
  showGeolocate = false,
  zoom = 13,
  className,
  onMapClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const initRef = useRef(false);

  // Stable center calculation — no state updates, just a ref
  const centerRef = useRef({ lng: 2.4183, lat: 6.3654 });

  // Compute center without triggering re-renders
  const computedCenter = useMemo(() => {
    if (pickup && dropoff) return { lng: (pickup.lng + dropoff.lng) / 2, lat: (pickup.lat + dropoff.lat) / 2 };
    if (pickup) return { lng: pickup.lng, lat: pickup.lat };
    if (dropoff) return { lng: dropoff.lng, lat: dropoff.lat };
    if (rider) return { lng: rider.lng, lat: rider.lat };
    if (riders && riders.length > 0) {
      return {
        lng: riders.reduce((s, r) => s + r.lng, 0) / riders.length,
        lat: riders.reduce((s, r) => s + r.lat, 0) / riders.length,
      };
    }
    return { lng: 2.4183, lat: 6.3654 };
  }, [pickup, dropoff, rider, riders]);

  // Initialize map ONCE
  useEffect(() => {
    if (!TOKEN || !containerRef.current || initRef.current) return;
    initRef.current = true;

    let map: any;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;

      mapboxgl.accessToken = TOKEN;

      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [computedCenter.lng, computedCenter.lat],
        zoom,
        attributionControl: false,
        trackResize: false, // CRITICAL: prevents the infinite resize observer loop
        fadeDuration: 0,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

      if (showGeolocate) {
        map.addControl(
          new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }),
          "bottom-right",
        );
      }

      map.on("load", () => {
        if (cancelled) return;
        mapRef.current = map;
        setLoaded(true);
      });

      if (onMapClick) {
        map.on("click", (e: any) => {
          onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        });
      }
    })();

    return () => {
      cancelled = true;
      if (map) {
        try { map.remove(); } catch {}
      }
      mapRef.current = null;
      initRef.current = false;
    };
    // Only run on mount — never re-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers imperatively (no React re-renders on the map)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    // Clear existing markers
    markersRef.current.forEach((m) => { try { m.remove(); } catch {} });
    markersRef.current = [];

    let mapboxgl: any;
    (async () => {
      mapboxgl = (await import("mapbox-gl")).default;

      // Pickup marker
      if (pickup) {
        const el = document.createElement("div");
        el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:28px;height:28px;border-radius:50%;background:oklch(0.72 0.2 45);display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.3);box-shadow:0 0 12px oklch(0.72 0.2 45 / 0.4)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div style="width:2px;height:8px;background:oklch(0.72 0.2 45 / 0.6)"></div>
        </div>`;
        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([pickup.lng, pickup.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }

      // Dropoff marker
      if (dropoff) {
        const el = document.createElement("div");
        el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:28px;height:28px;border-radius:50%;background:#1a1a2e;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.15);box-shadow:0 2px 8px rgba(0,0,0,0.3)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div style="width:2px;height:8px;background:rgba(255,255,255,0.15)"></div>
        </div>`;
        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([dropoff.lng, dropoff.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }

      // Rider marker
      if (rider) {
        const el = document.createElement("div");
        el.innerHTML = `<div style="position:relative;display:flex;align-items:center;justify-content:center">
          <div style="position:absolute;width:48px;height:48px;border-radius:50%;background:oklch(0.72 0.2 45 / 0.25);animation:pulse 1.4s infinite"></div>
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,oklch(0.72 0.2 45),oklch(0.65 0.22 30));border:2px solid rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px oklch(0.72 0.2 45 / 0.4)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          </div>
        </div>`;
        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([rider.lng, rider.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }

      // Fleet riders
      if (riders) {
        riders.forEach((r, i) => {
          const el = document.createElement("div");
          el.innerHTML = `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,oklch(0.72 0.2 45),oklch(0.65 0.22 30));border:2px solid rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px oklch(0.72 0.2 45 / 0.3)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          </div>`;
          const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([r.lng, r.lat])
            .addTo(map);
          markersRef.current.push(marker);
        });
      }
    })();
  }, [loaded, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, rider?.lat, rider?.lng, riders]);

  // Fly to new center when pins change — debounced to prevent loops
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const prev = centerRef.current;
    const next = computedCenter;

    // Only fly if the center actually moved meaningfully (> ~100m)
    const dlat = Math.abs(prev.lat - next.lat);
    const dlng = Math.abs(prev.lng - next.lng);
    if (dlat < 0.001 && dlng < 0.001) return;

    centerRef.current = next;

    // Use a timeout so we never flyTo during a React commit phase
    const t = setTimeout(() => {
      try {
        map.flyTo({ center: [next.lng, next.lat], zoom, duration: 600 });
      } catch {}
    }, 50);

    return () => clearTimeout(t);
  }, [loaded, computedCenter, zoom]);

  // Draw route line imperatively
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !showRoute || !TOKEN) return;

    let waypoints: LatLng[] = [];
    if (routeCoords && routeCoords.length >= 2) {
      waypoints = routeCoords;
    } else if (pickup && dropoff) {
      waypoints = [pickup, dropoff];
    }
    if (waypoints.length < 2) return;

    let cancelled = false;
    (async () => {
      try {
        const coordsStr = waypoints.map((wp) => `${wp.lng},${wp.lat}`).join(";");
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?geometries=geojson&access_token=${TOKEN}`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled || !data.routes?.[0]?.geometry) return;

        const geojson = { type: "Feature" as const, geometry: data.routes[0].geometry, properties: {} };

        if (map.getSource("route")) {
          (map.getSource("route") as any).setData(geojson);
        } else {
          map.addSource("route", { type: "geojson", data: geojson });
          map.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            paint: {
              "line-color": "oklch(0.72 0.2 45)",
              "line-width": 3,
              "line-dasharray": [2, 2],
              "line-opacity": 0.7,
            },
          });
        }
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [loaded, showRoute, routeCoords, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  // Draw active orders lines
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !activeOrders || activeOrders.length === 0) return;

    const geojson = {
      type: "FeatureCollection" as const,
      features: activeOrders.map((o) => ({
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [o.pickup.lng, o.pickup.lat],
            [o.dropoff.lng, o.dropoff.lat],
          ],
        },
        properties: { id: o.id },
      })),
    };

    if (map.getSource("active-orders")) {
      (map.getSource("active-orders") as any).setData(geojson);
    } else {
      map.addSource("active-orders", { type: "geojson", data: geojson });
      map.addLayer({
        id: "active-orders-line",
        type: "line",
        source: "active-orders",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ff5a00", "line-width": 4, "line-opacity": 0.8 },
      });
    }
  }, [loaded, activeOrders]);

  // No token fallback
  if (!TOKEN) {
    return (
      <div
        className={`rounded-3xl border border-white/5 flex flex-col items-center justify-center gap-2 bg-muted/20 ${className ?? ""}`}
        style={{ height }}
      >
        <MapPin className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground/50">Carte indisponible</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`} style={{ height }}>
      {/* Map container — fixed size, never changes */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
      />

      {/* Loading overlay */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded-3xl">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}

      {/* Inject pulse animation */}
      <style>{`@keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.15);opacity:0.7} }`}</style>
    </div>
  );
}
