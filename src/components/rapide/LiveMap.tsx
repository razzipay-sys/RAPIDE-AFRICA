import { useEffect, useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation } from "lucide-react";
import type { LayerProps } from "react-map-gl/mapbox";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

const routeLayer: LayerProps = {
  id: "route-line",
  type: "line",
  paint: {
    "line-color": "oklch(0.72 0.2 45)",
    "line-width": 3,
    "line-dasharray": [2, 2],
    "line-opacity": 0.7,
  },
};

type MapboxRuntime = {
  Map: typeof import("react-map-gl/mapbox").default;
  Marker: typeof import("react-map-gl/mapbox").Marker;
  NavigationControl: typeof import("react-map-gl/mapbox").NavigationControl;
  GeolocateControl: typeof import("react-map-gl/mapbox").GeolocateControl;
  Source: typeof import("react-map-gl/mapbox").Source;
  Layer: typeof import("react-map-gl/mapbox").Layer;
};

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
  showHeatmap = false,
  zoom = 13,
  className,
  onMapClick,
}: Props) {
  const [mapbox, setMapbox] = useState<MapboxRuntime | null>(null);
  const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
  const mapRef = useRef<any>(null);

  // Compute straight-line multi-routes for admin dashboard
  const activeOrdersGeoJSON = useMemo(() => {
    if (!activeOrders || activeOrders.length === 0) return null;
    return {
      type: "FeatureCollection" as const,
      features: activeOrders.map(o => ({
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [o.pickup.lng, o.pickup.lat],
            [o.dropoff.lng, o.dropoff.lat]
          ]
        },
        properties: { id: o.id }
      }))
    };
  }, [activeOrders]);

  useEffect(() => {
    if (!TOKEN) return;
    let cancelled = false;
    void (async () => {
      await import("mapbox-gl/dist/mapbox-gl.css");
      const mod = await import("react-map-gl/mapbox");
      if (cancelled) return;
      setMapbox({
        Map: mod.default,
        Marker: mod.Marker,
        NavigationControl: mod.NavigationControl,
        GeolocateControl: mod.GeolocateControl,
        Source: mod.Source,
        Layer: mod.Layer,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  const center = useMemo(() => {
    if (pickup && dropoff) return { longitude: (pickup.lng + dropoff.lng) / 2, latitude: (pickup.lat + dropoff.lat) / 2 };
    if (pickup) return { longitude: pickup.lng, latitude: pickup.lat };
    if (dropoff) return { longitude: dropoff.lng, latitude: dropoff.lat };
    if (rider) return { longitude: rider.lng, latitude: rider.lat };
    if (riders && riders.length > 0) {
      return {
        longitude: riders.reduce((s, r) => s + r.lng, 0) / riders.length,
        latitude: riders.reduce((s, r) => s + r.lat, 0) / riders.length,
      };
    }
    return { longitude: 2.4183, latitude: 6.3654 };
  }, [pickup, dropoff, rider, riders]);

  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.flyTo({ center: [center.longitude, center.latitude], zoom, duration: 800 });
    }
  }, [center.longitude, center.latitude, zoom]);

  useEffect(() => {
    if (!showRoute || !TOKEN) {
      setRouteGeoJSON(null);
      return;
    }
    
    // Determine the path to draw
    let waypoints: LatLng[] = [];
    if (routeCoords && routeCoords.length >= 2) {
      waypoints = routeCoords;
    } else if (pickup && dropoff) {
      waypoints = [pickup, dropoff];
    }
    
    if (waypoints.length < 2) {
      setRouteGeoJSON(null);
      return;
    }

    let cancelled = false;
    const fetchRoute = async () => {
      try {
        const coordsStr = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?geometries=geojson&access_token=${TOKEN}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (cancelled) return;
        
        if (data.routes && data.routes[0] && data.routes[0].geometry) {
          setRouteGeoJSON({
            type: "Feature",
            geometry: data.routes[0].geometry,
            properties: {}
          });
        }
      } catch (err) {
        console.error("Failed to fetch mapbox directions", err);
      }
    };

    fetchRoute();
    return () => { cancelled = true; };
  }, [showRoute, routeCoords, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

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

  if (!mapbox) {
    return (
      <div
        className={`rounded-3xl border border-white/5 flex items-center justify-center bg-muted/20 ${className ?? ""}`}
        style={{ height }}
      >
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const { Map, Marker, NavigationControl, GeolocateControl, Source, Layer } = mapbox;

  return (
    <div className={`rounded-3xl overflow-hidden border border-white/5 ${className ?? ""}`} style={{ height }}>
      <Map
        ref={mapRef}
        initialViewState={{ ...center, zoom }}
        mapboxAccessToken={TOKEN}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        onClick={onMapClick ? (e) => onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng }) : undefined}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        {showGeolocate && (
          <GeolocateControl position="bottom-right" trackUserLocation positionOptions={{ enableHighAccuracy: true }} />
        )}

        {routeGeoJSON && (
          <Source id="route" type="geojson" data={routeGeoJSON}>
            <Layer {...routeLayer} />
          </Source>
        )}

        {/* Admin Route Layers */}
        {activeOrdersGeoJSON && (
          <Source type="geojson" data={activeOrdersGeoJSON}>
            <Layer
              id="active-orders-line"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{
                "line-color": "#ff5a00",
                "line-width": 4,
                "line-opacity": 0.8,
              }}
            />
          </Source>
        )}

        {/* Heatmap Layer */}
        {showHeatmap && rider && (
          <Source
            type="geojson"
            data={{
              type: "FeatureCollection",
              features: Array.from({ length: 50 }).map(() => ({
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [
                    rider.lng + (Math.random() - 0.5) * 0.05,
                    rider.lat + (Math.random() - 0.5) * 0.05,
                  ],
                },
                properties: { weight: Math.random() },
              }))
            } as any}
          >
            <Layer
              id="demand-heatmap"
              type="heatmap"
              paint={{
                "heatmap-weight": ["get", "weight"],
                "heatmap-intensity": 1,
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0, "rgba(255, 90, 0, 0)",
                  0.2, "rgba(255, 140, 0, 0.4)",
                  0.5, "rgba(255, 60, 0, 0.7)",
                  1, "rgba(255, 0, 0, 1)"
                ],
                "heatmap-radius": 30,
                "heatmap-opacity": 0.6,
              }}
            />
          </Source>
        )}

        {pickup && (
          <Marker longitude={pickup.lng} latitude={pickup.lat} anchor="bottom">
            <div className="flex flex-col items-center">
              <div className="h-7 w-7 rounded-full bg-primary shadow-glow flex items-center justify-center border-2 border-white/30">
                <MapPin className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <div className="h-2 w-0.5 bg-primary/60" />
            </div>
          </Marker>
        )}

        {dropoff && (
          <Marker longitude={dropoff.lng} latitude={dropoff.lat} anchor="bottom">
            <div className="flex flex-col items-center">
              <div className="h-7 w-7 rounded-full bg-background border-2 border-border shadow-elegant flex items-center justify-center">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="h-2 w-0.5 bg-border" />
            </div>
          </Marker>
        )}

        {rider && (
          <Marker longitude={rider.lng} latitude={rider.lat} anchor="center">
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="relative flex items-center justify-center"
            >
              <div className="absolute h-12 w-12 rounded-full bg-primary/25" />
              <div className="h-10 w-10 rounded-full bg-gradient-primary shadow-glow border-2 border-white/40 flex items-center justify-center relative">
                <Navigation className="h-4 w-4 text-primary-foreground" />
              </div>
            </motion.div>
          </Marker>
        )}

        {riders?.map((r, i) => (
          <Marker key={r.id ?? i} longitude={r.lng} latitude={r.lat} anchor="center">
            <div className="h-9 w-9 rounded-full bg-gradient-primary shadow-glow border-2 border-white/40 flex items-center justify-center">
              <Navigation className="h-4 w-4 text-primary-foreground" />
            </div>
          </Marker>
        ))}
      </Map>
    </div>
  );
}
