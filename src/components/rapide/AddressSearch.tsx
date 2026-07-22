import { useState, useRef, useCallback, useEffect } from "react";
import { MapPin, Loader2, X, LocateFixed, History } from "lucide-react";
import type { GeoResult } from "@/lib/pricing";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

type Props = {
  label: string;
  icon: string;
  value: GeoResult | null;
  onChange: (r: GeoResult) => void;
  onFocus?: () => void;
  placeholder?: string;
  showCurrentLocation?: boolean;
};

const RECENTS_KEY = "rapide.recent-addresses";
const MAX_RECENTS = 5;

function loadRecents(): GeoResult[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(r: GeoResult) {
  try {
    const existing = loadRecents().filter((e) => e.name !== r.name);
    const next = [r, ...existing].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — ignore
  }
}

export function AddressSearch({
  label,
  icon,
  value,
  onChange,
  onFocus,
  placeholder,
  showCurrentLocation,
}: Props) {
  const { t } = useT();
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [recents, setRecents] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync displayed text when value changes externally (e.g. map click)
  useEffect(() => {
    if (value?.name && value.name !== query) setQuery(value.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.name]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 3) {
      setResults([]);
      return;
    }

    // Cancel any in-flight request so a slow earlier response can't
    // overwrite results from a more recent query (stale-response race).
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=bj&format=json&addressdetails=1&limit=6`;
      const res = await fetch(url, {
        headers: { "User-Agent": "RapideAfricaApp/1.0" },
        signal: controller.signal,
      });
      const data = await res.json();
      if (requestIdRef.current !== requestId) return; // superseded by a newer request
      setResults(
        (data ?? []).map((f: { display_name: string; lon: string; lat: string }) => ({
          name: f.display_name,
          lng: parseFloat(f.lon),
          lat: parseFloat(f.lat),
        })),
      );
      setOpen(true);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      // network error — ignore
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, []);

  const handleChange = (v: string) => {
    setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 400);
  };

  const select = (r: GeoResult) => {
    setQuery(r.name);
    setOpen(false);
    setResults([]);
    saveRecent(r);
    onChange(r);
  };

  const locateCurrentPosition = () => {
    if (!navigator.geolocation) {
      toast.error(t("book.location_unsupported") ?? "Geolocation not supported");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "User-Agent": "RapideAfricaApp/1.0" } },
          );
          const data = await res.json();
          select({ name: data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng });
        } catch {
          select({ name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng });
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.error(t("book.location_error") ?? "Couldn't get your location");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  // Ensure clicking outside closes the dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="flex items-center gap-1.5">
              <input
                value={query}
                onChange={(e) => handleChange(e.target.value)}
                onFocus={() => {
                  onFocus?.();
                  setRecents(loadRecents());
                  setOpen(true);
                }}
                placeholder={placeholder}
                className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/50"
              />
              {(loading || locating) && (
                <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />
              )}
              {query && !loading && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                    setOpen(false);
                  }}
                  aria-label="Clear address"
                  className="shrink-0"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </div>

      {open &&
        (results.length > 0 ||
          (query.trim().length < 3 && (showCurrentLocation || recents.length > 0))) && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 glass-strong rounded-2xl border border-border overflow-hidden shadow-elegant">
            {query.trim().length < 3 && showCurrentLocation && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  locateCurrentPosition();
                }}
                disabled={locating}
                className="w-full text-left px-4 py-3 hover:bg-white/5 transition border-b border-border/50 flex items-center gap-2 disabled:opacity-60"
              >
                {locating ? (
                  <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
                ) : (
                  <LocateFixed className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
                <span className="text-xs font-medium text-primary">
                  {locating ? t("book.locating") : t("book.use_current_location")}
                </span>
              </button>
            )}
            {query.trim().length < 3 &&
              recents.map((r, i) => (
                <button
                  key={`recent-${i}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(r);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition border-b border-border/50 last:border-0 flex items-start gap-2"
                >
                  <History className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-xs leading-relaxed text-foreground/90">{r.name}</span>
                </button>
              ))}
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(r);
                }}
                className="w-full text-left px-4 py-3 hover:bg-white/5 transition border-b border-border/50 last:border-0 flex items-start gap-2"
              >
                <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <span className="text-xs leading-relaxed text-foreground/90">{r.name}</span>
              </button>
            ))}
          </div>
        )}
    </div>
  );
}
