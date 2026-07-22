-- ============================================================
-- SECURITY FIXES: closes privilege-escalation / fund-diversion holes in
-- claim_order, complete_delivery, rate_delivery; adds the missing
-- wallet_transactions INSERT policy; locks down direct client writes to
-- protected `orders` columns; adds a wallets balance floor; fixes a
-- mutable search_path on generate_delivery_otp; and removes an overly
-- broad public storage-listing policy on chat-media.
-- ============================================================

-- ── 1. claim_order: derive caller from auth.uid(), not a client param ─────
-- Previously: claim_order(p_order_id, p_rider_id, p_user_id) never checked
-- p_user_id = auth.uid() nor that p_rider_id belonged to that caller — any
-- authenticated user could hijack any searching_rider order for any rider.
DROP FUNCTION IF EXISTS public.claim_order(uuid, uuid, uuid);

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

  IF NOT (
    v_is_self
    OR public.has_role(auth.uid(), 'dispatcher')
    OR public.has_role(auth.uid(), 'admin')
  ) THEN
    RETURN false;
  END IF;

  -- Trusted bypass for the order-update guard trigger below: this RPC has
  -- already authorized the caller above, and the rider isn't yet the
  -- assigned rider on this row (that's exactly the transition being made),
  -- so the trigger's normal "is this the assigned rider" check can't apply.
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

GRANT EXECUTE ON FUNCTION public.claim_order(uuid, uuid) TO authenticated;

-- ── 2. complete_delivery: derive the payee from the order's assigned ──────
--     rider, never a client-supplied wallet/user id.
-- Previously: complete_delivery(p_order_id, p_otp, p_rider_user_id) trusted
-- p_rider_user_id directly for the wallet credit — anyone who learned an
-- order's 4-digit OTP could redirect the payout to any wallet.
DROP FUNCTION IF EXISTS public.complete_delivery(uuid, text, uuid);

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

  IF NOT FOUND                        THEN RETURN false; END IF;
  IF v_status != 'in_transit'         THEN RETURN false; END IF;
  IF v_otp IS NULL OR v_otp != p_otp  THEN RETURN false; END IF;

  SELECT user_id INTO v_rider_user FROM public.riders WHERE id = v_rider_id;
  IF v_rider_user IS NULL THEN RETURN false; END IF;

  IF v_rider_user != auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN false;
  END IF;

  PERFORM set_config('rapide.bypass_order_guard', 'true', true);

  UPDATE public.orders
  SET    status = 'delivered', delivered_at = now()
  WHERE  id = p_order_id AND status = 'in_transit';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected != 1 THEN RETURN false; END IF;

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

GRANT EXECUTE ON FUNCTION public.complete_delivery(uuid, text) TO authenticated;

-- ── 3. rate_delivery: use auth.uid(), not a client-supplied customer id ───
-- Previously: rate_delivery(p_order_id, p_rating, p_customer_id) let anyone
-- who knew an order id and its customer id submit/overwrite that
-- customer's rating for a rider.
DROP FUNCTION IF EXISTS public.rate_delivery(uuid, integer, uuid);

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

  UPDATE public.orders
  SET    customer_rating = p_rating
  WHERE  id           = p_order_id
    AND  status       = 'delivered'
    AND  customer_id  = auth.uid()
    AND  customer_rating IS NULL;

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

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rate_delivery(uuid, integer) TO authenticated;

-- ── 4. wallet_transactions: missing INSERT policy (top-up flow was ────────
--     entirely non-functional under RLS for any non-admin user)
DROP POLICY IF EXISTS "tx_own_insert" ON public.wallet_transactions;
CREATE POLICY "tx_own_insert" ON public.wallet_transactions
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND type = 'topup'
  AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.wallets w
    WHERE w.id = wallet_transactions.wallet_id AND w.user_id = auth.uid()
  )
);

-- ── 5. orders: lock down direct client writes to protected columns ────────
-- USING-only RLS on order_update means any customer/rider who can touch a
-- row at all could previously set price_xof/status/rider_id to anything.
-- This trigger is the actual column-level guard; claim_order and
-- complete_delivery set a transaction-local bypass flag since they've
-- already done their own authorization above.
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
  -- only (rider_assigned -> rider_arriving -> picked_up -> in_transit).
  -- The in_transit -> delivered transition is OTP-gated and only happens
  -- via complete_delivery's bypass above, never directly here.
  IF v_is_rider THEN
    IF NEW.price_xof      IS NOT DISTINCT FROM OLD.price_xof
       AND NEW.commission_xof IS NOT DISTINCT FROM OLD.commission_xof
       AND NEW.rider_id       IS NOT DISTINCT FROM OLD.rider_id
       AND NEW.customer_id    IS NOT DISTINCT FROM OLD.customer_id
       AND (
         (OLD.status = 'rider_assigned' AND NEW.status = 'rider_arriving')
         OR (OLD.status = 'rider_arriving' AND NEW.status = 'picked_up')
         OR (OLD.status = 'picked_up' AND NEW.status = 'in_transit')
         OR NEW.status IS NOT DISTINCT FROM OLD.status
       )
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Riders may only advance order status through the standard delivery flow';
  END IF;

  -- Customer self-service cancel: only status may change, only from a
  -- pre-dispatch state, only by the order's own customer. (No client UI
  -- exposes this yet — see the customer-cancel feature build — but the
  -- guard is written to allow it once that ships.)
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

DROP TRIGGER IF EXISTS trg_enforce_order_update_guard ON public.orders;
CREATE TRIGGER trg_enforce_order_update_guard
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_update_guard();

-- ── 6. wallets: balance floor (verified zero existing negative balances) ──
ALTER TABLE public.wallets
  DROP CONSTRAINT IF EXISTS wallets_balance_nonneg;
ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_balance_nonneg CHECK (balance_xof >= 0);

-- ── 7. generate_delivery_otp: mutable search_path (Supabase advisor WARN) ─
CREATE OR REPLACE FUNCTION public.generate_delivery_otp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'in_transit'
     AND OLD.status IS DISTINCT FROM 'in_transit'
     AND NEW.delivery_otp IS NULL
  THEN
    NEW.delivery_otp = LPAD((FLOOR(RANDOM() * 10000))::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- ── 8. chat-media: remove public listing policy (Supabase advisor WARN) ───
-- Bucket is public=true, so getPublicUrl() fetch of a known object path
-- works with no SELECT policy at all. The broad "public can SELECT/list
-- every object" policy served no purpose the app actually uses (it never
-- calls storage .list()) and let anyone enumerate every conversation's
-- media across the entire platform.
DROP POLICY IF EXISTS "chat_media_select" ON storage.objects;
