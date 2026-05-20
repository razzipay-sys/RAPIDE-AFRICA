/**
 * Allowed origins for Edge Function CORS.
 * Add your production domain here once deployed.
 */
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:4173",
  // Production domains — add your Vercel URL and custom domain here:
  // "https://rapide-africa.vercel.app",
  // "https://rapide.africa",
]);

export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin =
    requestOrigin && ALLOWED_ORIGINS.has(requestOrigin)
      ? requestOrigin
      : "https://rapide.africa"; // safe fallback (non-existent → browser blocks)

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

/** Backwards-compat alias for files that haven't been updated yet */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
