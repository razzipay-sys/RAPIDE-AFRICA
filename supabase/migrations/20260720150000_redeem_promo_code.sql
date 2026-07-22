-- Wires the promo_codes/promo_code_uses backend (Section 13.2 — a fully
-- designed, RLS-protected backend that has been sitting completely unused
-- since 20260519000000_platform_expansion.sql) into the booking flow.
--
-- Redeeming atomically in one RPC — rather than the client reading
-- times_used/uses_per_user and then writing separately — is required to
-- avoid the same class of race condition already fixed elsewhere this
-- session (Section 1): two customers redeeming the last remaining use of a
-- max_uses code at the same instant must not both succeed. FOR UPDATE locks
-- the promo_codes row for the duration of the check+increment.
CREATE OR REPLACE FUNCTION public.redeem_promo_code(
  p_code text,
  p_order_total bigint
)
RETURNS TABLE(discount_xof bigint, use_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo      record;
  v_user_uses  integer;
  v_discount   bigint;
  v_use_id     uuid;
BEGIN
  SELECT * INTO v_promo FROM public.promo_codes
  WHERE upper(code) = upper(p_code) AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;
  IF now() < v_promo.valid_from THEN RETURN; END IF;
  IF v_promo.valid_until IS NOT NULL AND now() > v_promo.valid_until THEN RETURN; END IF;
  IF p_order_total < v_promo.min_order_xof THEN RETURN; END IF;
  IF v_promo.max_uses IS NOT NULL AND v_promo.times_used >= v_promo.max_uses THEN RETURN; END IF;

  SELECT count(*) INTO v_user_uses FROM public.promo_code_uses
  WHERE promo_code_id = v_promo.id AND user_id = auth.uid();
  IF v_user_uses >= v_promo.uses_per_user THEN RETURN; END IF;

  v_discount := CASE v_promo.type
    WHEN 'percentage' THEN LEAST(
      ROUND(p_order_total * v_promo.value / 100),
      COALESCE(v_promo.max_discount_xof, p_order_total)
    )
    WHEN 'fixed' THEN LEAST(v_promo.value::bigint, p_order_total)
    WHEN 'free_delivery' THEN p_order_total
    ELSE 0
  END;

  UPDATE public.promo_codes SET times_used = times_used + 1 WHERE id = v_promo.id;

  INSERT INTO public.promo_code_uses (promo_code_id, user_id, discount_xof)
  VALUES (v_promo.id, auth.uid(), v_discount)
  RETURNING id INTO v_use_id;

  RETURN QUERY SELECT v_discount, v_use_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text, bigint) TO authenticated;
