-- ============ MERCHANT API KEYS ============
-- Stores API keys for merchant integrations.
-- NOTE: In production, store bcrypt hash of the key, never plaintext.
-- key_prefix is shown in the UI (first 12 chars).
-- key_hash stores the full key (replace with hash for production security).

CREATE TABLE IF NOT EXISTS public.merchant_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Key',
  key_hash TEXT NOT NULL,        -- store bcrypt/sha256 hash in production
  key_prefix TEXT NOT NULL,      -- first 12 chars shown in UI
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT merchant_api_keys_user_limit CHECK (TRUE)   -- add per-user limit via policy
);

-- RLS
ALTER TABLE public.merchant_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchants_manage_own_keys"
  ON public.merchant_api_keys
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS merchant_api_keys_user_idx ON public.merchant_api_keys(user_id);

-- ============ BULK ORDER BATCHES ============
-- Tracks batch uploads from the merchant portal CSV tool.

CREATE TABLE IF NOT EXISTS public.bulk_order_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT,
  total_rows INT NOT NULL DEFAULT 0,
  success_rows INT NOT NULL DEFAULT 0,
  failed_rows INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'  CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.bulk_order_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchants_own_batches"
  ON public.bulk_order_batches
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============ ORDERS: add batch_id foreign key ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.bulk_order_batches(id) ON DELETE SET NULL;

-- ============ RIDERS: ensure GPS columns have index ============
CREATE INDEX IF NOT EXISTS riders_online_idx ON public.riders(is_online);
CREATE INDEX IF NOT EXISTS riders_user_id_idx ON public.riders(user_id);

-- ============ ORDERS: index for dispatch queue ============
CREATE INDEX IF NOT EXISTS orders_dispatch_idx ON public.orders(status, rider_id)
  WHERE status = 'searching_rider' AND rider_id IS NULL;
