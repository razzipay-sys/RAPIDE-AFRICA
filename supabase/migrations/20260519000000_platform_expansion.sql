-- ============================================================
-- RAPIDE EXPRESS — PLATFORM EXPANSION MIGRATION
-- Real-time chat, notifications, driver docs, promo codes,
-- ratings, saved places, support tickets, surge zones
-- ============================================================

-- ============ CONVERSATIONS ============
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'order_chat'
    CHECK (type IN ('order_chat', 'support', 'dispatch')),
  participant_1 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unread_1 INT NOT NULL DEFAULT 0,   -- unread count for participant_1
  unread_2 INT NOT NULL DEFAULT 0,   -- unread count for participant_2
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_chat CHECK (participant_1 <> participant_2)
);

CREATE INDEX IF NOT EXISTS conv_p1_idx ON public.conversations(participant_1);
CREATE INDEX IF NOT EXISTS conv_p2_idx ON public.conversations(participant_2);
CREATE INDEX IF NOT EXISTS conv_order_idx ON public.conversations(order_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversation_participants"
  ON public.conversations FOR ALL
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- ============ MESSAGES ============
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL DEFAULT 'text'
    CHECK (type IN ('text', 'image', 'audio', 'system')),
  content TEXT,
  media_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  translated_content TEXT,     -- cached AI translation
  translate_from TEXT,         -- source language ('fr' / 'en')
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS msg_conv_idx ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS msg_sender_idx ON public.messages(sender_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_conversation_participants"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

CREATE POLICY "message_insert_own"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

CREATE POLICY "message_update_own"
  ON public.messages FOR UPDATE
  USING (sender_id = auth.uid());

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN ('order_update', 'chat_message', 'payment', 'promotion', 'system', 'kyc_update')),
  title TEXT NOT NULL,
  body TEXT,
  action_url TEXT,      -- deep link e.g. "/app/track/order-id"
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notif_user_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notif_unread_idx ON public.notifications(user_id, is_read) WHERE NOT is_read;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_own"
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============ DRIVER DOCUMENTS ============
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN ('license', 'vehicle_registration', 'insurance', 'id_card', 'profile_photo')),
  file_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rider_id, type)
);

ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_docs_own"
  ON public.driver_documents FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.riders r WHERE r.id = rider_id AND r.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'support')
  );

CREATE POLICY "driver_docs_insert"
  ON public.driver_documents FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.riders r WHERE r.id = rider_id AND r.user_id = auth.uid())
  );

CREATE POLICY "driver_docs_admin_update"
  ON public.driver_documents FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

-- ============ SAVED PLACES ============
CREATE TABLE IF NOT EXISTS public.saved_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  icon TEXT NOT NULL DEFAULT 'map-pin',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_places_own"
  ON public.saved_places FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============ RATINGS ============
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  reviewee_id UUID NOT NULL REFERENCES auth.users(id),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, reviewer_id)
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings_insert_own"
  ON public.ratings FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "ratings_select_own"
  ON public.ratings FOR SELECT
  USING (auth.uid() = reviewer_id OR auth.uid() = reviewee_id
    OR public.has_role(auth.uid(), 'admin'));

-- ============ SUPPORT TICKETS ============
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  order_id UUID REFERENCES public.orders(id),
  category TEXT NOT NULL
    CHECK (category IN ('payment', 'delivery', 'driver', 'app_issue', 'other')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to UUID REFERENCES auth.users(id),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ticket_user_idx ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS ticket_status_idx ON public.support_tickets(status, priority);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_own"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

CREATE POLICY "tickets_insert"
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tickets_staff_update"
  ON public.support_tickets FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

-- ============ PROMO CODES ============
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed', 'free_delivery')),
  value NUMERIC NOT NULL,
  min_order_xof INT NOT NULL DEFAULT 0,
  max_discount_xof INT,
  max_uses INT,
  uses_per_user INT NOT NULL DEFAULT 1,
  times_used INT NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promo_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  order_id UUID REFERENCES public.orders(id),
  discount_xof INT NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_codes_select_all"
  ON public.promo_codes FOR SELECT USING (true);

CREATE POLICY "promo_codes_admin_write"
  ON public.promo_codes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "promo_uses_own"
  ON public.promo_code_uses FOR ALL
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============ SURGE ZONES ============
CREATE TABLE IF NOT EXISTS public.surge_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  multiplier NUMERIC NOT NULL DEFAULT 1.0 CHECK (multiplier >= 1.0 AND multiplier <= 5.0),
  polygon JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  reason TEXT CHECK (reason IN ('high_demand', 'weather', 'event', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.surge_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "surge_zones_select_all"
  ON public.surge_zones FOR SELECT USING (true);

CREATE POLICY "surge_zones_admin_write"
  ON public.surge_zones FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ ADD orders.rating_submitted ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS rating_submitted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- ============ FUNCTION: create notification ============
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, action_url, data)
  VALUES (p_user_id, p_type, p_title, p_body, p_action_url, p_data)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;

-- ============ FUNCTION: open_or_get_conversation ============
-- Returns existing conversation between two users for an order,
-- or creates a new one.
CREATE OR REPLACE FUNCTION public.open_or_get_conversation(
  p_order_id UUID,
  p_other_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_conv_id UUID;
  v_me UUID := auth.uid();
BEGIN
  -- Look for existing conversation
  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE order_id = p_order_id
    AND ((participant_1 = v_me AND participant_2 = p_other_user_id)
      OR (participant_1 = p_other_user_id AND participant_2 = v_me))
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (order_id, participant_1, participant_2, type)
    VALUES (p_order_id, v_me, p_other_user_id, 'order_chat')
    RETURNING id INTO v_conv_id;
  END IF;

  RETURN v_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_or_get_conversation TO authenticated;
