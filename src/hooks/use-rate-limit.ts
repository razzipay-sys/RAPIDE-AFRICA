import { useRef, useCallback } from "react";

// UX-only debounce (resets on refresh, trivially bypassed) — not a security
// control. Server-side enforcement lives in the edge functions' own
// checkRateLimit (see supabase/functions/_shared/rateLimiter.ts), which is
// DB-backed and atomic.
export function useRateLimit(maxCalls: number, windowMs: number) {
  const timestamps = useRef<number[]>([]);

  const check = useCallback((): boolean => {
    const now = Date.now();
    const cutoff = now - windowMs;
    timestamps.current = timestamps.current.filter((t) => t > cutoff);
    if (timestamps.current.length >= maxCalls) return false;
    timestamps.current.push(now);
    return true;
  }, [maxCalls, windowMs]);

  return { check };
}
