import { useState, useRef, useCallback, useEffect } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import type { GeoResult } from "@/lib/pricing";
import { CITIES } from "@/lib/pricing";
import { useAIAddress } from "@/hooks/use-ai-address";
import { Sparkles } from "lucide-react";

type Props = {
  label: string;
  icon: string;
  value: GeoResult | null;
  onChange: (r: GeoResult) => void;
  onFocus?: () => void;
  placeholder?: string;
};

export function AddressSearch({ label, icon, value, onChange, onFocus, placeholder }: Props) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { resolveAddress, isResolving } = useAIAddress();

  // Sync displayed text when value changes externally (e.g. map click)
  useEffect(() => {
    if (value?.name && value.name !== query) setQuery(value.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.name]);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 3) { setResults([]); return; }
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=bj&format=json&addressdetails=1&limit=6`;
      const res = await fetch(url, { headers: { "User-Agent": "RapideAfricaApp/1.0" } });
      const data = await res.json();
      setResults(
        (data ?? []).map((f: any) => ({
          name: f.display_name,
          lng: parseFloat(f.lon),
          lat: parseFloat(f.lat),
        })),
      );
      setOpen(true);
    } catch {
      // network error — ignore
    }
    setLoading(false);
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
    onChange(r);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // No Mapbox token — fallback to city dropdown
  if (!TOKEN) {
    return (
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
            {icon}
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <select
              value={value?.name ?? ""}
              onChange={(e) => {
                const city = CITIES.find((c) => c.name === e.target.value);
                if (city) onChange(city);
              }}
              className="w-full bg-transparent text-sm font-medium outline-none"
            >
              {CITIES.map((c) => (
                <option key={c.name} value={c.name} className="bg-background">
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <MapPin className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  }

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
                  if (results.length > 0) setOpen(true);
                }}
                placeholder={placeholder}
                className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/50"
              />
              {loading && (
                <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />
              )}
              {query.length > 10 && !loading && (
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    const res = await resolveAddress(query);
                    if (res) select(res);
                  }}
                  disabled={isResolving}
                  className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-semibold flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                  title="Use AI to find this description"
                >
                  {isResolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  AI
                </button>
              )}
              {query && !loading && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                    setOpen(false);
                  }}
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

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 glass-strong rounded-2xl border border-border overflow-hidden shadow-elegant">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); select(r); }}
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
