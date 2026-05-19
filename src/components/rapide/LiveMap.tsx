import { useEffect, useState, useMemo } from "react";
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

type Props = {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  rider?: LatLng | null;
  riders?: RiderPin[];
  height?: number;
  showRoute?: boolean;
  showGeolocate?: boolean;
  zoom?: number;
  className?: string;
};

export function LiveMap({
  pickup,
  dropoff,
  rider,
  riders,
  height = 260,
  showRoute = false,
  showGeolocate = false,
  zoom = 13,
  className,
}: Props) {
  const [mapbox, setMapbox] = useState<MapboxRuntime | null>(null);

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

  const routeGeoJSON = useMemo(() => {
    if (!showRoute || !pickup || !dropoff) return null;
    const coords: [number, number][] = [[pickup.lng, pickup.lat]];
    if (rider) coords.push([rider.lng, rider.lat]);
    coords.push([dropoff.lng, dropoff.lat]);
    return { type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: coords }, properties: {} };
  }, [showRoute, pickup, dropoff, rider]);

  if (!TOKEN || !mapbox) return null;

  const { Map, Marker, NavigationControl, GeolocateControl, Source, Layer } = mapbox;

  return (
    <div className={`rounded-3xl overflow-hidden border border-white/5 ${className ?? ""}`} style={{ height }}>
      <Map
        initialViewState={{ ...center, zoom }}
        mapboxAccessToken={TOKEN}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
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
