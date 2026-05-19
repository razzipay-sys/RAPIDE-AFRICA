-- ── OTP: auto-generate 4-digit code when order transitions to in_transit ──────
CREATE OR REPLACE FUNCTION public.generate_delivery_otp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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

DROP TRIGGER IF EXISTS trg_generate_delivery_otp ON public.orders;
CREATE TRIGGER trg_generate_delivery_otp
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_delivery_otp();

-- ── complete_delivery: rider provides OTP to confirm handoff ──────────────────
CREATE OR REPLACE FUNCTION public.complete_delivery(
  p_order_id      uuid,
  p_otp           text,
  p_rider_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otp           text;
  v_status        text;
  rows_affected   integer;
BEGIN
  SELECT delivery_otp, status
  INTO   v_otp, v_status
  FROM   public.orders
  WHERE  id = p_order_id;

  IF NOT FOUND                          THEN RETURN false; END IF;
  IF v_status != 'in_transit'           THEN RETURN false; END IF;
  IF v_otp IS NULL OR v_otp != p_otp   THEN RETURN false; END IF;

  UPDATE public.orders
  SET    status       = 'delivered',
         delivered_at = now()
  WHERE  id = p_order_id
    AND  status = 'in_transit';

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 1 THEN
    INSERT INTO public.order_events (order_id, status, created_by)
    VALUES (p_order_id, 'delivered', p_rider_user_id);

    -- Increment rider total_deliveries counter
    UPDATE public.riders r
    SET    total_deliveries = total_deliveries + 1
    FROM   public.orders o
    WHERE  o.id = p_order_id
      AND  r.id = o.rider_id;

    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_delivery(uuid, text, uuid) TO authenticated;

-- ── rate_delivery: customer rates after completion ────────────────────────────
CREATE OR REPLACE FUNCTION public.rate_delivery(
  p_order_id      uuid,
  p_rating        integer,
  p_customer_id   uuid
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
    AND  customer_id  = p_customer_id
    AND  customer_rating IS NULL;

  -- Update rider average rating
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

GRANT EXECUTE ON FUNCTION public.rate_delivery(uuid, integer, uuid) TO authenticated;

-- ── Performance index: OTP lookup ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_status_rider
  ON public.orders (status, rider_id)
  WHERE status NOT IN ('delivered', 'cancelled', 'failed');
