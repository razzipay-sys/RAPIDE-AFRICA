/**
 * Allowed origins for Edge Function CORS.
 *
 * Driven by the ALLOWED_ORIGINS secret (comma-separated) rather than a
 * hardcoded list, since the real production domain lives in Vercel's
 * dashboard config, not this repo. Set it with:
 *   supabase secrets set ALLOWED_ORIGINS="https://your-domain.com,https://your-project.vercel.app"
 * Localhost dev origins are always allowed in addition to whatever is set.
 */
const DEV_ORIGINS = new Set(["http://localhost:5173", "http://localhost:4173"]);

function getConfiguredOrigins(): Set<string> {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  const configured = raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return new Set([...DEV_ORIGINS, ...configured]);
}

export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowed = getConfiguredOrigins();
  // No match → omit Access-Control-Allow-Origin entirely rather than falling
  // back to a guessed domain; the browser blocks the response either way,
  // but this doesn't silently claim an origin is trusted when it isn't.
  const origin = requestOrigin && allowed.has(requestOrigin) ? requestOrigin : "";

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
