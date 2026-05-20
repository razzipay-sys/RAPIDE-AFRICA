-- merchant_api_keys: stores API keys for merchant integrations
-- key_hash stores a hashed version; key_prefix is shown in UI for identification

create table if not exists merchant_api_keys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  key_hash      text not null,
  key_prefix    text not null,
  is_active     boolean not null default true,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index on merchant_api_keys (user_id);

-- Only the owner can read/write their own keys
alter table merchant_api_keys enable row level security;

create policy "merchant_api_keys_owner_select"
  on merchant_api_keys for select
  using (auth.uid() = user_id);

create policy "merchant_api_keys_owner_insert"
  on merchant_api_keys for insert
  with check (auth.uid() = user_id);

create policy "merchant_api_keys_owner_update"
  on merchant_api_keys for update
  using (auth.uid() = user_id);

create policy "merchant_api_keys_owner_delete"
  on merchant_api_keys for delete
  using (auth.uid() = user_id);
