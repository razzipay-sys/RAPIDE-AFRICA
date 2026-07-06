import { lazy } from "react";

/**
 * Leaflet touches `window`/`document` at module import time, which throws
 * during SSR (this app runs a full SSR dev server via TanStack Start).
 * Guarding the dynamic import means the chunk is only ever requested in
 * the browser — on the server the lazy promise simply never resolves, so
 * the Suspense fallback is what gets sent in the initial HTML.
 */
export const LiveMap = lazy(() =>
  typeof window !== "undefined"
    ? import("@/components/rapide/LiveMap").then((m) => ({ default: m.LiveMap }))
    : new Promise<{ default: (typeof import("@/components/rapide/LiveMap"))["LiveMap"] }>(() => {}),
);

export function MapSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div
      className="w-full rounded-3xl bg-muted/30 animate-pulse flex items-center justify-center"
      style={{ height }}
    >
      <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>
  );
}
