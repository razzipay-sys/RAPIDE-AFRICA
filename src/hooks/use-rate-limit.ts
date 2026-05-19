import { useRef, useCallback } from "react";

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
