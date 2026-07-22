-- Order Lifecycle redesign — Step 2, part B (see CODE_AUDIT_ISSUES.txt
-- Section 12). Requires 20260720140000's enum values already committed.

-- ── 1. refund_status: a separate column, not an order_status value ────────
-- (12.8's own recommendation) — an order can be refunded without losing
-- what actually happened to it (delivered-then-refunded vs
-- cancelled-then-refunded are different facts worth keeping).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none'
    CHECK (refund_status IN ('none', 'requested', 'refunded'));

CREATE OR REPLACE FUNCTION public.admin_set_refund_status(
  p_order_id uuid,
  p_status   text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN false; END IF;
  IF p_status NOT IN ('none', 'requested', 'refunded') THEN RETURN false; END IF;

  UPDATE public.orders SET refund_status = p_status WHERE id = p_order_id;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected != 1 THEN RETURN false; END IF;

  INSERT INTO public.order_events (order_id, status, created_by, note)
  SELECT p_order_id, status, auth.uid(), 'Refund status set to ' || p_status
  FROM public.orders WHERE id = p_order_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_refund_status(uuid, text) TO authenticated;

-- ── 2. claim_order: self-claim only now, goes straight to rider_accepted ──
-- (12.3: "self-claimed orders collapse both transitions into one atomic
-- action" — a rider claiming from the open queue IS accepting). Dispatcher/
-- admin assignment moves to the new assign_order below, which stops at
-- rider_assigned pending the rider's explicit accept/decline.
CREATE OR REPLACE FUNCTION public.claim_order(
  p_order_id uuid,
  p_rider_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected integer;
  v_is_self     boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.riders WHERE id = p_rider_id AND user_id = auth.uid()
  ) INTO v_is_self;

  IF NOT v_is_self THEN
    RETURN false;
  END IF;

  PERFORM set_config('rapide.bypass_order_guard', 'true', true);

  UPDATE public.orders
  SET    rider_id = p_rider_id, status = 'rider_accepted'
  WHERE  id = p_order_id AND status = 'searching_rider' AND rider_id IS NULL;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 1 THEN
    INSERT INTO public.order_events (order_id, status, created_by)
    VALUES (p_order_id, 'rider_accepted', auth.uid());
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_order(uuid, uuid) TO authenticated;

-- ── 3. assign_order: dispatcher/admin assigns a rider, who must still ─────
-- explicitly accept (rider_assigned, not rider_accepted).
CREATE OR REPLACE FUNCTION public.assign_order(
  p_order_id uuid,
  p_rider_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected integer;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'admin')) THEN
    RETURN false;
  END IF;

  PERFORM set_config('rapide.bypass_order_guard', 'true', true);

  UPDATE public.orders
  SET    rider_id = p_rider_id, status = 'rider_assigned'
  WHERE  id = p_order_id AND status = 'searching_rider' AND rider_id IS NULL;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 1 THEN
    INSERT INTO public.order_events (order_id, status, created_by)
    VALUES (p_order_id, 'rider_assigned', auth.uid());
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_order(uuid, uuid) TO authenticated;

-- ── 4. accept_order / decline_order: the rider's response to a dispatcher ─
-- assignment. Declining hands the order back to the open pool rather than
-- leaving it stuck on a rider who won't take it.
CREATE OR REPLACE FUNCTION public.accept_order(
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
  SELECT rider_id INTO v_rider_id FROM public.orders WHERE id = p_order_id AND status = 'rider_assigned';
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT user_id INTO v_rider_user FROM public.riders WHERE id = v_rider_id;
  IF v_rider_user IS NULL OR v_rider_user != auth.uid() THEN RETURN false; END IF;

  PERFORM set_config('rapide.bypass_order_guard', 'true', true);

  UPDATE public.orders SET status = 'rider_accepted'
  WHERE id = p_order_id AND status = 'rider_assigned';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected != 1 THEN RETURN false; END IF;

  INSERT INTO public.order_events (order_id, status, created_by)
  VALUES (p_order_id, 'rider_accepted', auth.uid());
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_order(
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
  SELECT rider_id INTO v_rider_id FROM public.orders WHERE id = p_order_id AND status = 'rider_assigned';
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT user_id INTO v_rider_user FROM public.riders WHERE id = v_rider_id;
  IF v_rider_user IS NULL OR v_rider_user != auth.uid() THEN RETURN false; END IF;

  PERFORM set_config('rapide.bypass_order_guard', 'true', true);

  UPDATE public.orders SET status = 'searching_rider', rider_id = NULL
  WHERE id = p_order_id AND status = 'rider_assigned';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected != 1 THEN RETURN false; END IF;

  INSERT INTO public.order_events (order_id, status, created_by, note)
  VALUES (p_order_id, 'searching_rider', auth.uid(), 'Rider declined assignment');
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_order(uuid) TO authenticated;

-- ── 5. enforce_order_update_guard: extend the rider-editable transition ───
-- graph for rider_accepted (replaces rider_assigned as the flow's start)
-- and the new in_transit -> near_destination geofence step.
CREATE OR REPLACE FUNCTION public.enforce_order_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_rider boolean;
BEGIN
  IF current_setting('rapide.bypass_order_guard', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher') THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.riders r WHERE r.id = OLD.rider_id AND r.user_id = auth.uid()
  ) INTO v_is_rider;

  -- Assigned rider may advance status through the normal delivery sequence
  -- only (rider_accepted -> rider_arriving -> picked_up -> in_transit ->
  -- near_destination). The in_transit/near_destination -> delivered
  -- transition is OTP-gated and only happens via complete_delivery's
  -- bypass above, never directly here.
  IF v_is_rider THEN
    IF NEW.price_xof      IS NOT DISTINCT FROM OLD.price_xof
       AND NEW.commission_xof IS NOT DISTINCT FROM OLD.commission_xof
       AND NEW.rider_id       IS NOT DISTINCT FROM OLD.rider_id
       AND NEW.customer_id    IS NOT DISTINCT FROM OLD.customer_id
       AND (
         (OLD.status = 'rider_accepted' AND NEW.status = 'rider_arriving')
         OR (OLD.status = 'rider_arriving' AND NEW.status = 'picked_up')
         OR (OLD.status = 'picked_up' AND NEW.status = 'in_transit')
         OR (OLD.status = 'in_transit' AND NEW.status = 'near_destination')
         OR NEW.status IS NOT DISTINCT FROM OLD.status
       )
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Riders may only advance order status through the standard delivery flow';
  END IF;

  -- Customer self-service cancel: only status may change, only from a
  -- pre-dispatch state, only by the order's own customer.
  IF auth.uid() = OLD.customer_id
     AND OLD.status IN ('pending', 'searching_rider')
     AND NEW.status = 'cancelled'
     AND NEW.price_xof      IS NOT DISTINCT FROM OLD.price_xof
     AND NEW.commission_xof IS NOT DISTINCT FROM OLD.commission_xof
     AND NEW.rider_id       IS NOT DISTINCT FROM OLD.rider_id THEN
    RETURN NEW;
  END IF;

  IF NEW.price_xof      IS DISTINCT FROM OLD.price_xof
     OR NEW.commission_xof IS DISTINCT FROM OLD.commission_xof
     OR NEW.status         IS DISTINCT FROM OLD.status
     OR NEW.rider_id       IS DISTINCT FROM OLD.rider_id
     OR NEW.customer_id    IS DISTINCT FROM OLD.customer_id THEN
    RAISE EXCEPTION 'Direct modification of protected order fields is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 6. complete_delivery: accept from in_transit OR near_destination; log ─
-- a delivery_verification event ahead of delivered so the state has real
-- representation in the audit trail/timeline, without ever parking the
-- order's actual status column there (12.4's own concern: a half-verified
-- order stuck mid-flow if the rider's connection drops). Both events are
-- written inside this one atomic RPC, so that risk never materializes.
CREATE OR REPLACE FUNCTION public.complete_delivery(
  p_order_id uuid,
  p_otp      text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otp         text;
  v_status      text;
  v_price       bigint;
  v_commission  bigint;
  v_rider_id    uuid;
  v_rider_user  uuid;
  rows_affected integer;
BEGIN
  SELECT o.delivery_otp, o.status, o.price_xof, o.commission_xof, o.rider_id
  INTO   v_otp, v_status, v_price, v_commission, v_rider_id
  FROM   public.orders o
  WHERE  o.id = p_order_id;

  IF NOT FOUND                                          THEN RETURN false; END IF;
  IF v_status NOT IN ('in_transit', 'near_destination')  THEN RETURN false; END IF;
  IF v_otp IS NULL OR v_otp != p_otp                     THEN RETURN false; END IF;

  SELECT user_id INTO v_rider_user FROM public.riders WHERE id = v_rider_id;
  IF v_rider_user IS NULL THEN RETURN false; END IF;

  IF v_rider_user != auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN false;
  END IF;

  PERFORM set_config('rapide.bypass_order_guard', 'true', true);

  UPDATE public.orders
  SET    status = 'delivered', delivered_at = now()
  WHERE  id = p_order_id AND status = v_status;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected != 1 THEN RETURN false; END IF;

  INSERT INTO public.order_events (order_id, status, created_by)
  VALUES (p_order_id, 'delivery_verification', v_rider_user);
  INSERT INTO public.order_events (order_id, status, created_by)
  VALUES (p_order_id, 'delivered', v_rider_user);

  UPDATE public.riders SET total_deliveries = total_deliveries + 1
  WHERE id = v_rider_id;

  PERFORM public._wallet_credit(
    v_rider_user,
    GREATEST(v_price - v_commission, 0),
    'payout',
    NULL,
    p_order_id,
    'Delivery payout'
  );
  RETURN true;
END;
$$;

-- ── 7. rate_delivery: sets the rating_submitted column that already ───────
-- existed but nothing ever wrote (dead since 20260519000000), and flips
-- delivered -> completed on rating (the boundary decided with the user:
-- Completed = customer has rated).
CREATE OR REPLACE FUNCTION public.rate_delivery(
  p_order_id uuid,
  p_rating   integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN RETURN false; END IF;

  PERFORM set_config('rapide.bypass_order_guard', 'true', true);

  UPDATE public.orders
  SET    customer_rating = p_rating, rating_submitted = true, status = 'completed'
  WHERE  id           = p_order_id
    AND  status       = 'delivered'
    AND  customer_id  = auth.uid()
    AND  customer_rating IS NULL;

  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.order_events (order_id, status, created_by)
  VALUES (p_order_id, 'completed', auth.uid());

  UPDATE public.riders r
  SET    rating = (
           SELECT ROUND(AVG(o.customer_rating)::numeric, 2)
           FROM   public.orders o
           WHERE  o.rider_id = r.id
             AND  o.customer_rating IS NOT NULL
         )
  FROM   public.orders ord
  WHERE  ord.id = p_order_id
    AND  r.id   = ord.rider_id;

  RETURN true;
END;
$$;

-- ── 8. auto_complete_stale_deliveries: the 48h grace-window fallback for ──
-- orders the customer never rates (12.5's second candidate boundary, used
-- here only as a backstop — the primary trigger is rate_delivery above).
CREATE OR REPLACE FUNCTION public.auto_complete_stale_deliveries()
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
    WHERE status = 'delivered' AND delivered_at < now() - interval '48 hours'
  LOOP
    UPDATE public.orders SET status = 'completed'
    WHERE id = v_order_id AND status = 'delivered';

    INSERT INTO public.order_events (order_id, status, note)
    VALUES (v_order_id, 'completed', 'Auto-completed: no rating within 48 hours');
  END LOOP;
END;
$$;

-- No auth check inside, cron-only — same reasoning as expire_stale_orders.
REVOKE EXECUTE ON FUNCTION public.auto_complete_stale_deliveries() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_complete_stale_deliveries() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_complete_stale_deliveries() FROM authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-complete-stale-deliveries') THEN
    PERFORM cron.schedule(
      'auto-complete-stale-deliveries',
      '*/30 * * * *',
      $j$SELECT public.auto_complete_stale_deliveries();$j$
    );
  END IF;
END;
$$;
