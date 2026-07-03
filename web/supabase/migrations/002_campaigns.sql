-- Campaign registry: human metadata + initialize snapshot for fast browse.
-- Run after 001_campaign_allowlist.sql.

create table if not exists campaigns (
  campaign_address text primary key,
  collection_address text not null,
  mint_address text not null,
  creator_wallet text not null,
  cluster text not null,
  merkle_root text not null,

  name text,
  uri text,
  total_deposit numeric not null check (total_deposit > 0),

  start_at timestamptz not null,
  end_at timestamptz not null,
  cliff_duration_sec bigint not null,
  cliff_release_bps int not null check (cliff_release_bps between 0 and 10000),
  grace_period_sec bigint not null,
  is_transferable boolean not null,

  init_signature text not null,
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active', 'cancelled', 'closed')),

  created_at timestamptz not null default now()
);

create index if not exists campaigns_creator_wallet_idx
  on campaigns (creator_wallet);

create index if not exists campaigns_mint_address_idx
  on campaigns (mint_address);

create index if not exists campaigns_created_at_idx
  on campaigns (created_at desc);

alter table campaigns enable row level security;

create policy "campaigns_select"
  on campaigns for select
  using (true);

create policy "campaigns_insert"
  on campaigns for insert
  with check (true);

-- Allowlist rows must reference a registered campaign.
alter table campaign_allowlists
  add constraint campaign_allowlists_campaign_fkey
  foreign key (campaign_address)
  references campaigns (campaign_address)
  on delete cascade;
