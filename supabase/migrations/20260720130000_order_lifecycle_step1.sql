-- Order Lifecycle redesign — Step 1, part B (see CODE_AUDIT_ISSUES.txt
-- Section 12). Requires 20260720125000's enum values to already exist in a
-- prior, committed transaction.
--
-- ALSO FIXES A LIVE CRITICAL BUG found while scoping this: orders are
-- created with status='pending' (app.book.tsx, app.errand.tsx,
-- merchant/bulk.tsx) but every rider-matching path — the dispatch queue
-- (rider/dispatch.tsx), its realtime subscription, claim_order, and the
-- dispatcher assignment view — only ever looks at status='searching_rider'.
-- Nothing anywhere transitions pending -> searching_rider. Result: every
-- order ever booked has been invisible to every rider, forever. Verified
-- live: the only order that exists in production today is stuck at
-- 'pending'. Fixed at the DB layer (not just the call sites) so no future
-- insert path can reintroduce the same dead state.

-- ── 1. Close the pending/searching_rider dead-state gap at the DB layer.
CREATE OR REPLACE FUNCTION public.advance_pending_orders()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    NEW.status := 'searching_rider';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_advance_pending_orders ON public.orders;
CREATE TRIGGER trg_advance_pending_orders
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.advance_pending_orders();

-- Backfill: the one order already stranded in production.
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  PERFORM set_config('rapide.bypass_order_guard', 'true', true);
  FOR v_order_id IN SELECT id FROM public.orders WHERE status = 'pending' LOOP
    UPDATE public.orders SET status = 'searching_rider' WHERE id = v_order_id;
    INSERT INTO public.order_events (order_id, status, note)
    VALUES (v_order_id, 'searching_rider', 'Backfilled: order was stranded at pending, never visible to riders (Order Lifecycle Step 1 fix)');
  END LOOP;
END;
$$;

-- ── 2. report_delivery_failure: rider-triggered failed_pickup /
--       failed_delivery, replacing the dead 'failed' value with two real,
--       reason-carrying terminal states (Section 12.1, 9.14).
CREATE OR REPLACE FUNCTION public.report_delivery_failure(
  p_order_id uuid,
  p_reason   text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status      text;
  v_rider_id    uuid;
  v_rider_user  uuid;
  v_new_status  public.order_status;
  rows_affected integer;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RETURN false;
  END IF;

  SELECT o.status, o.rider_id INTO v_status, v_rider_id
  FROM public.orders o WHERE o.id = p_order_id;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT user_id INTO v_rider_user FROM public.riders WHERE id = v_rider_id;
  IF v_rider_user IS NULL THEN RETURN false; END IF;

  IF v_rider_user != auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT public.has_role(auth.uid(), 'dispatcher')
  THEN
    RETURN false;
  END IF;

  IF v_status IN ('rider_assigned', 'rider_arriving') THEN
    v_new_status := 'failed_pickup';
  ELSIF v_status IN ('picked_up', 'in_transit') THEN
    v_new_status := 'failed_delivery';
  ELSE
    RETURN false;
  END IF;

  PERFORM set_config('rapide.bypass_order_guard', 'true', true);

  UPDATE public.orders
  SET    status = v_new_status, cancellation_reason = p_reason, cancelled_at = now()
  WHERE  id = p_order_id AND status = v_status;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected != 1 THEN RETURN false; END IF;

  INSERT INTO public.order_events (order_id, status, created_by, note)
  VALUES (p_order_id, v_new_status, auth.uid(), p_reason);
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_delivery_failure(uuid, text) TO authenticated;

-- ── 3. mark_order_returned: package physically returned after a failed
--       delivery (Section 6.12's missing "Returned" filter needs a real
--       write path, not just a badge).
CREATE OR REPLACE FUNCTION public.mark_order_returned(
  p_order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider_id    uuid;
  v_rider_user  uuid;
  rows_affected integer;
BEGIN
  SELECT rider_id INTO v_rider_id FROM public.orders WHERE id = p_order_id AND status = 'failed_delivery';
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT user_id INTO v_rider_user FROM public.riders WHERE id = v_rider_id;

  IF (v_rider_user IS NULL OR v_rider_user != auth.uid())
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT public.has_role(auth.uid(), 'dispatcher')
  THEN
    RETURN false;
  END IF;

  PERFORM set_config('rapide.bypass_order_guard', 'true', true);

  UPDATE public.orders SET status = 'returned'
  WHERE id = p_order_id AND status = 'failed_delivery';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected != 1 THEN RETURN false; END IF;

  INSERT INTO public.order_events (order_id, status, created_by)
  VALUES (p_order_id, 'returned', auth.uid());
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_order_returned(uuid) TO authenticated;

-- ── 4. admin_reject_order: admin/dispatcher-only rejection of a booking
--       before a rider is ever assigned (fraud/policy review, not a rider
--       declining — see Section 12.7's disambiguation).
CREATE OR REPLACE FUNCTION public.admin_reject_order(
  p_order_id uuid,
  p_reason   text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected integer;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher')) THEN
    RETURN false;
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RETURN false;
  END IF;

  PERFORM set_config('rapide.bypass_order_guard', 'true', true);

  UPDATE public.orders
  SET    status = 'rejected', cancellation_reason = p_reason, cancelled_at = now()
  WHERE  id = p_order_id AND status IN ('pending', 'searching_rider');
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected != 1 THEN RETURN false; END IF;

  INSERT INTO public.order_events (order_id, status, created_by, note)
  VALUES (p_order_id, 'rejected', auth.uid(), p_reason);
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_order(uuid, text) TO authenticated;

-- ── 5. Expired: a scheduled job, not just the read-only "Needs Attention"
--       warning that already exists (Section 12.6). Threshold set above the
--       existing 10-minute admin-alert threshold so the alert fires first
--       and gives an operator a chance to intervene before auto-expiry.
CREATE OR REPLACE FUNCTION public.expire_stale_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  PERFORM set_config('rapide.bypass_order_guard', 'true', true);

  FOR v_order_id IN
    SELECT id FROM public.orders
    WHERE status = 'searching_rider' AND created_at < now() - interval '15 minutes'
  LOOP
    UPDATE public.orders
    SET status = 'expired', cancellation_reason = 'No rider found within 15 minutes', cancelled_at = now()
    WHERE id = v_order_id AND status = 'searching_rider';

    INSERT INTO public.order_events (order_id, status, note)
    VALUES (v_order_id, 'expired', 'Auto-expired: no rider claimed within 15 minutes');
  END LOOP;
END;
$$;

-- No auth.uid()/has_role check inside — this runs only via the pg_cron job
-- below (which executes as the job owner, not through PostgREST). Its
-- PUBLIC execute grant (the Postgres default on CREATE FUNCTION, which
-- Supabase exposes to anon/authenticated via /rest/v1/rpc) is revoked in
-- 20260720131500_restrict_expire_stale_orders_execute.sql.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-orders') THEN
    PERFORM cron.schedule(
      'expire-stale-orders',
      '*/5 * * * *',
      $j$SELECT public.expire_stale_orders();$j$
    );
  END IF;
END;
$$;
