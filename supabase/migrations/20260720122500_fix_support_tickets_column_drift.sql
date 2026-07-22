-- support_tickets.description was the originally-migrated column name, but
-- the app (src/routes/support/index.tsx and app.wallet.tsx's withdrawal
-- request insert) has always read/written `message` — a schema-drift bug
-- flagged in a comment in an earlier migration but never fixed. This meant
-- the entire support ticket list query (selects a nonexistent `message`
-- column) and the wallet withdrawal-request flow (inserts into a
-- nonexistent `message` column) both failed against the live database.
ALTER TABLE public.support_tickets RENAME COLUMN description TO message;
