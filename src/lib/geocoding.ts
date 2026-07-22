// Shared Nominatim (OpenStreetMap) geocoding — same public, free-tier API
// AddressSearch.tsx uses for live search. Nominatim's usage policy caps
// free-tier requests at ~1/sec, so anything geocoding multiple addresses
// (e.g. a merchant bulk CSV upload) must go through geocodeSequentially,
// not fire requests in parallel.
export type GeoPoint = { lat: number; lng: number };

export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&countrycodes=bj&format=json&limit=1`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "RapideAfricaApp/1.0" } });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

// Geocodes a list of addresses one at a time (Nominatim rate-limit
// compliance), reusing one result for any repeated address string — a
// merchant bulk upload typically repeats the same pickup_address across
// every row, so this avoids re-geocoding it hundreds of times.
export async function geocodeSequentially(
  addresses: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, GeoPoint | null>> {
  const unique = [...new Set(addresses.map((a) => a.trim()).filter(Boolean))];
  const results = new Map<string, GeoPoint | null>();
  for (let i = 0; i < unique.length; i++) {
    results.set(unique[i], await geocodeAddress(unique[i]));
    onProgress?.(i + 1, unique.length);
    if (i < unique.length - 1) await new Promise((r) => setTimeout(r, 1100));
  }
  return results;
}
