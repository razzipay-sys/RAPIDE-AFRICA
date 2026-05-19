-- Atomic order claim to prevent race conditions between riders
CREATE OR REPLACE FUNCTION public.claim_order(
  p_order_id uuid,
  p_rider_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected integer;
BEGIN
  UPDATE public.orders
  SET
    rider_id = p_rider_id,
    status   = 'rider_assigned'
  WHERE id        = p_order_id
    AND status    = 'searching_rider'
    AND rider_id  IS NULL;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 1 THEN
    INSERT INTO public.order_events (order_id, status, created_by)
    VALUES (p_order_id, 'rider_assigned', p_user_id);
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_order(uuid, uuid, uuid) TO authenticated;
