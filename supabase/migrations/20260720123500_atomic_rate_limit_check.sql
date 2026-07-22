-- supabase/functions/_shared/rateLimiter.ts previously did a check then a
-- separate insert, so concurrent requests from the same user could all read
-- the same pre-insert count and all pass. Row-level locking via a per-key
-- advisory lock makes the check+insert atomic without locking the whole
-- table.
CREATE OR REPLACE FUNCTION public.check_and_log_rate_limit(
  p_user_action text,
  p_max_requests integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Serialize concurrent calls for the same key only (hashtext gives a
  -- stable 32-bit key from the action string).
  PERFORM pg_advisory_xact_lock(hashtext(p_user_action));

  SELECT count(*) INTO v_count FROM public.rate_limit_log
  WHERE user_action = p_user_action
    AND created_at >= now() - (p_window_seconds || ' seconds')::interval;

  IF v_count >= p_max_requests THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limit_log (user_action) VALUES (p_user_action);
  RETURN true;
END;
$$;

-- Not granted to `authenticated` — only called from edge functions using
-- the service-role client.
