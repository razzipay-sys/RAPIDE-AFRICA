// Rapide pricing engine (XOF)
export type DeliveryType = "standard" | "express" | "scheduled";
export type GeoResult = { name: string; lat: number; lng: number };

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const INSURANCE_SURCHARGE_XOF = 300;
// Single source of truth for the platform commission rate — was previously
// duplicated as a second, inconsistent literal (0.15) in merchant/bulk.tsx.
export const COMMISSION_RATE = 0.18;

export function quote(opts: {
  distanceKm: number;
  type: DeliveryType;
  insurance: boolean;
  weightKg?: number;
}) {
  const base = 500;
  const perKm = 150;
  const distance_fee = opts.distanceKm * perKm;
  let price = base + distance_fee;
  
  let type_multiplier = 1.0;
  if (opts.type === "express") type_multiplier = 1.5;
  if (opts.type === "scheduled") type_multiplier = 0.9;
  
  price *= type_multiplier;
  
  let weight_surcharge = 0;
  if ((opts.weightKg ?? 0) > 5) weight_surcharge = ((opts.weightKg ?? 0) - 5) * 80;
  
  price += weight_surcharge;
  
  let insurance_fee = 0;
  if (opts.insurance) insurance_fee = INSURANCE_SURCHARGE_XOF;
  
  price += insurance_fee;
  const total = Math.max(800, Math.round(price / 50) * 50);
  
  // Calculate base fare for receipt display (accounting for rounding)
  const base_fare = total - insurance_fee - weight_surcharge;
  
  return { 
    price_xof: total, 
    commission_xof: Math.round(total * COMMISSION_RATE),
    breakdown: {
      base_fare,
      insurance_fee,
      weight_surcharge
    }
  };
}

export const fmtXOF = (n: number) => `${n.toLocaleString("fr-FR")} XOF`;

// Approximate Benin city coords for prototype geocoding
export const CITIES = [
  { name: "Cotonou — Ganhi", lat: 6.3654, lng: 2.4183 },
  { name: "Cotonou — Cadjehoun", lat: 6.3527, lng: 2.3895 },
  { name: "Cotonou — Akpakpa", lat: 6.3676, lng: 2.4438 },
  { name: "Porto-Novo Centre", lat: 6.4969, lng: 2.6283 },
  { name: "Calavi — Abomey-Calavi", lat: 6.4485, lng: 2.3556 },
  { name: "Sèmè-Podji", lat: 6.3667, lng: 2.6167 },
  { name: "Ouidah", lat: 6.3622, lng: 2.0852 },
  { name: "Parakou", lat: 9.3372, lng: 2.6303 },
];
