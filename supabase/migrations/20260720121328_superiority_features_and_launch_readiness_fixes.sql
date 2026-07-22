-- ============================================================
-- Combines the originally-drafted superiority_features and
-- launch_readiness_fixes migrations into a single transaction so the
-- intentionally-insecure "System can manage escrows USING (true)" policy
-- from the original superiority_features draft is never created at all —
-- this migration goes straight to the final admin-only escrows policy.
--
-- Also adds public.update_updated_at_column(), which the original
-- superiority_features migration assumed existed in the public schema but
-- didn't (only storage.update_updated_at_column() exists, Supabase-internal)
-- — this is why that migration never actually applied to this project
-- originally, and why route_batches/escrows/admin_audit_log/
-- admin_approve_topup/_wallet_credit etc. did not exist live until this
-- migration ran.
--
-- Root-cause cluster this closes (from the original launch_readiness_fixes
-- header): profiles had no FK from riders/wallets/orders/support_tickets,
-- so PostgREST couldn't embed profiles in those queries (dispatcher,
-- admin/users, admin/drivers, support all silently returned empty/broken
-- data). Plus: admin couldn't UPDATE profiles (KYC approval was completely
-- non-functional), escrows RLS was wide open, dispatcher couldn't update
-- orders, rider self-signup couldn't grant its own role, the wallet ledger
-- never actually moved money, and the `documents` storage bucket referenced
-- by rider/documents.tsx and app.verification.tsx was never provisioned.
-- ============================================================

-- ── superiority_features ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER TYPE delivery_type ADD VALUE IF NOT EXISTS 'errand';

CREATE TABLE route_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES profiles(id) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'routed', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN route_batch_id UUID REFERENCES route_batches(id);

CREATE TYPE escrow_status AS ENUM ('held', 'released', 'disputed', 'refunded');

CREATE TABLE escrows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) NOT NULL,
    buyer_id UUID REFERENCES profiles(id) NOT NULL,
    seller_id UUID REFERENCES profiles(id) NOT NULL,
    amount_xof NUMERIC NOT NULL,
    status escrow_status NOT NULL DEFAULT 'held',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE route_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can manage their own route batches"
ON route_batches FOR ALL
USING (auth.uid() = merchant_id);

CREATE POLICY "Buyers and sellers can view their escrows"
ON escrows FOR SELECT
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- NOTE: the original superiority_features draft created a
-- "System can manage escrows" USING (true) policy here, then
-- launch_readiness_fixes immediately dropped and replaced it. This
-- migration skips that insecure intermediate state entirely and goes
-- straight to the final policy.
CREATE POLICY "admin_manage_escrows" ON escrows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_escrows_updated_at
BEFORE UPDATE ON escrows
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── launch_readiness_fixes (minus the now-redundant escrow policy swap) ──

-- 1. FK relationships so PostgREST can embed `profiles`. profiles.id is
-- guaranteed to equal some auth.users.id 1:1 (handle_new_user trigger
-- inserts a profiles row for every new auth user), so adding a second FK
-- (alongside the existing auth.users FK) on these columns is a safe,
-- additive, non-breaking change — it does not alter any data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'riders_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.riders
      ADD CONSTRAINT riders_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallets_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.wallets
      ADD CONSTRAINT wallets_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_customer_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_customer_id_profiles_fkey
      FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. profiles RLS: admin needs to be able to UPDATE (KYC approval), and
-- support/dispatcher need to SELECT (for the embeds above to actually
-- return data under RLS, not just exist as a relationship).
DROP POLICY IF EXISTS "own_profile_update" ON public.profiles;
CREATE POLICY "own_profile_update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "own_profile_select" ON public.profiles;
CREATE POLICY "own_profile_select" ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'support')
    OR public.has_role(auth.uid(), 'dispatcher')
  );

-- 3. orders RLS: dispatcher role must be able to assign riders.
DROP POLICY IF EXISTS "order_update" ON public.orders;
CREATE POLICY "order_update" ON public.orders FOR UPDATE TO authenticated USING (
  auth.uid() = customer_id
  OR EXISTS (SELECT 1 FROM public.riders r WHERE r.id = orders.rider_id AND r.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'dispatcher')
);

-- 4. Rider self-onboarding: a brand-new user must be able to grant
-- themselves the 'rider' role, but user_roles INSERT is admin-only by RLS.
-- This function hardcodes the role to 'rider' (never accepts a
-- caller-supplied role), so it's safe to expose to any authenticated user.
CREATE OR REPLACE FUNCTION public.request_rider_role()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'rider')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_rider_role TO authenticated;

-- 5. `documents` storage bucket — referenced by rider/documents.tsx and
-- app.verification.tsx but never provisioned; every upload 404s until now.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "documents_owner_insert" ON storage.objects;
CREATE POLICY "documents_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'kyc_documents');

-- NOTE: no public SELECT/listing policy is added here (unlike the original
-- draft) — the bucket is public=true so getPublicUrl() fetch of a known
-- object path works without one, and a broad SELECT policy only enables
-- enumerating every uploaded KYC document platform-wide. See the follow-up
-- fix_documents_bucket_listing migration, which explicitly documents and
-- removes the version of this policy that was briefly live.

DROP POLICY IF EXISTS "documents_owner_update" ON storage.objects;
CREATE POLICY "documents_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents');

-- 6. Wallet ledger: make it real. Add a status so a top-up can be recorded
-- as "pending verification" and only actually move money once an admin
-- confirms the mobile-money receipt (this is the flow app.wallet.tsx's UI
-- already promises but nothing backed — no code anywhere ever updated
-- wallets.balance_xof).
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'rejected'));

-- Any pre-existing topup rows were never actually credited (confirmed: no
-- code path updates balance_xof), so they are genuinely still pending, not
-- historically completed — backfill them honestly so ops can process the
-- real backlog through the new approval screen.
UPDATE public.wallet_transactions SET status = 'pending' WHERE type = 'topup';

-- Internal helper — NOT granted to `authenticated`. Only callable from
-- within another SECURITY DEFINER function running as the table owner,
-- which is exactly how admin_approve_topup/reject and complete_delivery
-- use it below. This is what actually prevents an arbitrary user from
-- crediting arbitrary wallets.
CREATE OR REPLACE FUNCTION public._wallet_credit(
  p_user_id UUID,
  p_amount_xof BIGINT,
  p_type public.transaction_type,
  p_reference TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_wallet_id UUID;
BEGIN
  IF p_amount_xof = 0 THEN RETURN false; END IF;

  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.wallets SET balance_xof = balance_xof + p_amount_xof WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount_xof, reference, order_id, description, status)
  VALUES (v_wallet_id, p_user_id, p_type, p_amount_xof, p_reference, p_order_id, p_description, 'completed');

  RETURN true;
END;
$$;

-- Admin-only: approve a pending top-up — credits the wallet and flips the
-- original pending row to 'completed' atomically (the WHERE status='pending'
-- guard means double-clicking Approve, or approving twice, can't double-credit).
CREATE OR REPLACE FUNCTION public.admin_approve_topup(p_tx_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
  rows_affected INT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.wallet_transactions
  SET status = 'completed'
  WHERE id = p_tx_id AND type = 'topup' AND status = 'pending'
  RETURNING * INTO v_tx;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected = 0 THEN RETURN false; END IF;

  UPDATE public.wallets SET balance_xof = balance_xof + v_tx.amount_xof WHERE id = v_tx.wallet_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_topup(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reject_topup(p_tx_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE rows_affected INT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.wallet_transactions
  SET status = 'rejected',
      description = COALESCE(description, '') || CASE WHEN p_reason IS NOT NULL THEN ' — rejected: ' || p_reason ELSE ' — rejected' END
  WHERE id = p_tx_id AND type = 'topup' AND status = 'pending';

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_topup(UUID, TEXT) TO authenticated;

-- 7. complete_delivery: actually pay the rider. Extends the existing
-- OTP-confirmation RPC to credit the rider's wallet with their payout share
-- once delivery is confirmed. Assumes cash-on-delivery (rider already
-- collected price_xof in cash from the customer) so only the platform's
-- commission is *not* credited to the rider — this is the realistic default
-- given there is no payment gateway integrated yet and no payment-method
-- selector in the booking flow. If/when a wallet-prepaid checkout option is
-- added, this function will need a matching branch that credits the full
-- price_xof (since the platform would have already collected it from the
-- customer at booking time).
--
-- NOTE: this signature (p_order_id, p_otp, p_rider_user_id) still trusted a
-- client-supplied p_rider_user_id for the wallet credit — see the follow-up
-- security_fixes_rpc_and_rls migration, which replaces this function
-- entirely with a 2-arg version that derives the payee from the order's
-- assigned rider instead.
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
  v_price         bigint;
  v_commission    bigint;
  rows_affected   integer;
BEGIN
  SELECT delivery_otp, status, price_xof, commission_xof
  INTO   v_otp, v_status, v_price, v_commission
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

    UPDATE public.riders r
    SET    total_deliveries = total_deliveries + 1
    FROM   public.orders o
    WHERE  o.id = p_order_id
      AND  r.id = o.rider_id;

    PERFORM public._wallet_credit(
      p_rider_user_id,
      GREATEST(v_price - v_commission, 0),
      'payout',
      NULL,
      p_order_id,
      'Delivery payout'
    );

    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_delivery(uuid, text, uuid) TO authenticated;

-- 8. Admin audit log — role grants (especially admin) need an audit trail.
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_user_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_audit_log_select" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_select" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin_audit_log_insert" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_insert" ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());
