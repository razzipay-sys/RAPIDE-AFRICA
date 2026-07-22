-- expire_stale_orders is meant to run only via the pg_cron job (which
-- executes as the job owner, not through the exposed PostgREST API) — it
-- has no internal auth.uid()/has_role check, unlike every other RPC added
-- in this pass. Postgres grants EXECUTE to PUBLIC by default on function
-- creation, which Supabase exposes to both anon and authenticated over
-- /rest/v1/rpc/expire_stale_orders; without this revoke, any signed-in (or
-- even anonymous) caller could force any order stuck in searching_rider
-- past the 15-minute mark to expire early, whenever they liked.
REVOKE EXECUTE ON FUNCTION public.expire_stale_orders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_stale_orders() FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_stale_orders() FROM authenticated;
