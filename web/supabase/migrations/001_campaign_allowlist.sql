-- Campaign-scoped merkle allowlists (leaves + precomputed proofs).
-- Run in Supabase SQL editor or via CLI.

create table if not exists campaign_allowlists (
  campaign_address text primary key,
  merkle_root text not null,
  creator_wallet text not null,
  leaf_count int not null check (leaf_count > 0),
  source_sha256 text,
  created_at timestamptz not null default now()
);

create table if not exists allowlist_entries (
  campaign_address text not null references campaign_allowlists (campaign_address) on delete cascade,
  wallet text not null,
  allocation numeric not null check (allocation > 0),
  proofs jsonb not null,
  primary key (campaign_address, wallet)
);

create index if not exists allowlist_entries_campaign_wallet_idx
  on allowlist_entries (campaign_address, wallet);

alter table campaign_allowlists enable row level security;
alter table allowlist_entries enable row level security;

-- MVP: public read (proofs are derivable from public leaves).
create policy "allowlist_entries_select"
  on allowlist_entries for select
  using (true);

create policy "campaign_allowlists_select"
  on campaign_allowlists for select
  using (true);

-- MVP: open insert — tighten with signed creator auth before production.
create policy "campaign_allowlists_insert"
  on campaign_allowlists for insert
  with check (true);

create policy "allowlist_entries_insert"
  on allowlist_entries for insert
  with check (true);
