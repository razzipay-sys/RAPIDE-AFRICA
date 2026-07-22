-- Order Lifecycle redesign — Step 2, part A (see CODE_AUDIT_ISSUES.txt
-- Section 12). Enum expansion only, own transaction (same reason as Step
-- 1's 20260720125000: Postgres forbids using a new enum value in the same
-- transaction that added it).
--
-- Scope decision (resolved with the user 2026-07-20): 'draft', 'submitted',
-- 'payment_pending', 'confirmed' are NOT added here. Every order today is
-- cash-on-delivery with no payment gateway, so those four states would be
-- pure dead enum values nothing ever writes — exactly the schema-drift
-- anti-pattern already caught once this session (Section 13). They're
-- reserved in the centralized state-machine module
-- (src/lib/order-lifecycle.ts) as a documented future slot for when a real
-- gateway lands; orders continue straight from creation to 'searching_rider'
-- ("Awaiting Rider" in the UI label) same as Step 1, which functions as the
-- collapsed equivalent of Draft->Submitted->Payment Pending->Confirmed for
-- COD orders.
--
-- 'refunded' is also NOT added as a status value — see 12.8's own
-- recommendation: folding it into order_status would force a delivered (or
-- cancelled) order to leave its terminal state, losing what actually
-- happened. Modeled instead as a separate orders.refund_status column in
-- part B, which can coexist with any terminal status.
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rider_accepted';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'near_destination';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delivery_verification';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'completed';
