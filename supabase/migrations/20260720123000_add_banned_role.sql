-- src/routes/admin/users.tsx's ban/unban feature has always inserted
-- role: 'banned' into user_roles, but 'banned' was never actually added to
-- the app_role enum — every ban/unban action has been failing against the
-- live database. This was masked by a stale local types.ts that apparently
-- assumed 'banned' existed; regenerating types against the real schema
-- surfaced the gap.
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'banned';
