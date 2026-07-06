import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default icon path issues in Leaflet with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

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

// Custom Icons matching the UI
const pickupIcon = L.divIcon({
  className: "custom-div-icon",
  html: `<div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:28px;height:28px;border-radius:50%;background:oklch(0.72 0.2 45);display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.3);box-shadow:0 0 12px oklch(0.72 0.2 45 / 0.4)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div style="width:2px;height:8px;background:oklch(0.72 0.2 45 / 0.6)"></div>
        </div>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
});

const dropoffIcon = L.divIcon({
  className: "custom-div-icon",
  html: `<div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:28px;height:28px;border-radius:50%;background:hsl(var(--background));display:flex;align-items:center;justify-content:center;border:2px solid hsl(var(--border));box-shadow:0 0 12px rgba(0,0,0,0.3)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div style="width:2px;height:8px;background:hsl(var(--border))"></div>
        </div>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
});

const riderIcon = L.divIcon({
  className: "custom-div-icon",
  html: `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(to right, oklch(0.72 0.2 45), oklch(0.65 0.2 30));display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.4);box-shadow:0 0 15px oklch(0.72 0.2 45 / 0.5)">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
         </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// Component to handle map clicks and bounds updates
function MapController({
  center,
  onMapClick,
  pickup,
  dropoff,
  routeCoords,
}: {
  center: LatLng;
  onMapClick?: (latlng: LatLng) => void;
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  routeCoords?: LatLng[];
}) {
  const map = useMap();

  useEffect(() => {
    if (onMapClick) {
      const handleClick = (e: L.LeafletMouseEvent) => {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      };
      map.on("click", handleClick);
      return () => {
        map.off("click", handleClick);
      };
    }
  }, [map, onMapClick]);

  // Fit bounds if both pickup and dropoff are present
  useEffect(() => {
    if (pickup && dropoff) {
      const bounds = L.latLngBounds([pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]);
      if (routeCoords) {
        routeCoords.forEach((c) => bounds.extend([c.lat, c.lng]));
      }
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    } else {
      map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
    }
  }, [map, pickup, dropoff, center, routeCoords]);

  return null;
}

export function LiveMap({
  pickup,
  dropoff,
  rider,
  riders,
  activeOrders,
  height = 260,
  showRoute = false,
  routeCoords,
  zoom = 13,
  className,
  onMapClick,
}: Props) {
  // Compute center
  const center = useMemo(() => {
    if (pickup && dropoff)
      return { lng: (pickup.lng + dropoff.lng) / 2, lat: (pickup.lat + dropoff.lat) / 2 };
    if (pickup) return { lng: pickup.lng, lat: pickup.lat };
    if (dropoff) return { lng: dropoff.lng, lat: dropoff.lat };
    if (rider) return { lng: rider.lng, lat: rider.lat };
    if (riders && riders.length > 0) {
      return {
        lng: riders.reduce((s, r) => s + r.lng, 0) / riders.length,
        lat: riders.reduce((s, r) => s + r.lat, 0) / riders.length,
      };
    }
    return { lng: 2.4183, lat: 6.3654 }; // Cotonou default
  }, [pickup, dropoff, rider, riders]);

  const routePolyline = useMemo(() => {
    if (!showRoute || (!pickup && !dropoff && !routeCoords)) return null;
    const pts: [number, number][] = [];
    if (routeCoords) {
      pts.push(...routeCoords.map((c) => [c.lat, c.lng] as [number, number]));
    } else {
      if (pickup) pts.push([pickup.lat, pickup.lng]);
      if (rider) pts.push([rider.lat, rider.lng]);
      if (dropoff) pts.push([dropoff.lat, dropoff.lng]);
    }
    return pts;
  }, [showRoute, pickup, dropoff, rider, routeCoords]);

  return (
    <div className={`relative w-full ${className ?? ""}`} style={{ height, zIndex: 0 }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        {/* Voyager is a beautiful, free basemap style that requires no API key */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        <MapController
          center={center}
          onMapClick={onMapClick}
          pickup={pickup}
          dropoff={dropoff}
          routeCoords={routeCoords}
        />

        {routePolyline && routePolyline.length > 1 && (
          <Polyline
            positions={routePolyline}
            color="oklch(0.72 0.2 45)"
            weight={4}
            dashArray="10, 10"
            opacity={0.8}
          />
        )}

        {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />}
        {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />}
        {rider && <Marker position={[rider.lat, rider.lng]} icon={riderIcon} />}

        {riders?.map((r, i) => (
          <Marker key={r.id ?? i} position={[r.lat, r.lng]} icon={riderIcon} />
        ))}

        {activeOrders?.map((o) => (
          <Polyline
            key={o.id}
            positions={[
              [o.pickup.lat, o.pickup.lng],
              [o.dropoff.lat, o.dropoff.lng],
            ]}
            color="#ff5a00"
            weight={3}
            opacity={0.5}
          />
        ))}
      </MapContainer>

      {/* Remove Mapbox specific styles, add Leaflet specific overrides */}
      <style>{`
        .leaflet-container { background: hsl(var(--muted)); z-index: 1; border-radius: inherit; }
        .custom-div-icon { background: transparent; border: none; }
      `}</style>
    </div>
  );
}
