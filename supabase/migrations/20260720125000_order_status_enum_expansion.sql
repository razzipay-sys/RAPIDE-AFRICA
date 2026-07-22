-- Order Lifecycle redesign — Step 1, part A (see CODE_AUDIT_ISSUES.txt
-- Section 12). Enum expansion only, applied as its own migration/
-- transaction: Postgres forbids using a newly-added enum value (even
-- inside a function body that gets parse-checked) within the same
-- transaction that added it. Part B (20260720130000) adds the trigger,
-- RPCs, and cron job that reference these new values.
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'failed_pickup';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'failed_delivery';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'returned';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'expired';
