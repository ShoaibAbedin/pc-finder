-- Phase 3: settings, AI caches, usage tracking, ranking snapshots.

-- Title hash lets identical titles (same product at several retailers, or unchanged titles) share one AI parse.
alter table products        add column if not exists title_hash text generated always as (md5(category || '|' || title)) stored;
alter table ozbargain_deals add column if not exists title_hash text generated always as (md5(category || '|' || title)) stored;
create index if not exists products_title_hash_idx on products (title_hash);
create index if not exists ozbargain_deals_title_hash_idx on ozbargain_deals (title_hash);

-- Single row holding my settings (no accounts).
create table if not exists app_settings (
  id         integer primary key default 1 check (id = 1),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- AI job 1 cache: structured specs per unique (category, title).
create table if not exists spec_cache (
  title_hash text primary key,
  category   text not null,
  title      text not null,
  specs      jsonb not null,
  provider   text not null,
  model      text not null,
  parsed_at  timestamptz not null default now()
);

-- AI job 2 result: target tiers + budget split for the current settings.
create table if not exists build_targets (
  id            integer primary key default 1 check (id = 1),
  settings_hash text not null,
  data          jsonb not null,
  provider      text not null,
  model         text not null,
  created_at    timestamptz not null default now()
);

-- AI job 4 cache: one-line reasons, keyed by the facts they were written from.
create table if not exists ai_reasons (
  item_key   text not null,
  facts_hash text not null,
  reason     text not null,
  provider   text not null,
  model      text not null,
  created_at timestamptz not null default now(),
  primary key (item_key, facts_hash)
);

-- Daily request counter per provider (to stay inside free limits).
create table if not exists ai_usage (
  day      date not null default (now() at time zone 'Australia/Melbourne')::date,
  provider text not null,
  requests integer not null default 0,
  failures integer not null default 0,
  tokens   integer not null default 0,
  primary key (day, provider)
);

create or replace function bump_ai_usage(p_provider text, p_ok boolean, p_tokens integer)
returns void language sql as $$
  insert into ai_usage (day, provider, requests, failures, tokens)
  values ((now() at time zone 'Australia/Melbourne')::date, p_provider, 1, case when p_ok then 0 else 1 end, coalesce(p_tokens, 0))
  on conflict (day, provider) do update
     set requests = ai_usage.requests + 1,
         failures = ai_usage.failures + excluded.failures,
         tokens   = ai_usage.tokens + excluded.tokens;
$$;

-- Ranking snapshots. Each run scores every live listing; For You = diversified top N.
create table if not exists ranking_runs (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  settings_hash text not null,
  item_count    integer not null default 0
);

create table if not exists ranking_items (
  run_id       bigint not null references ranking_runs(id) on delete cascade,
  item_key     text not null,          -- 'p:<product id>' or 'oz:<node id>'
  category     text not null,
  score        real not null,
  breakdown    jsonb not null,         -- {fit, budget, discount, convenience, stock, notes[]}
  for_you_rank integer,                -- null unless in the For You list
  snapshot     jsonb,                  -- display data for For You items (title, price from scraped data, url...)
  primary key (run_id, item_key)
);
create index if not exists ranking_items_for_you_idx on ranking_items (run_id, for_you_rank) where for_you_rank is not null;
create index if not exists ranking_items_score_idx on ranking_items (run_id, category, score desc);

-- Latest scores joined onto listings, for "Best match" sorting on category pages.
create or replace view deal_listings_ranked with (security_invoker = true) as
with latest as (select max(id) as id from ranking_runs)
select d.*, ri.score as match_score
  from deal_listings d
  left join ranking_items ri
         on ri.run_id = (select id from latest)
        and ri.item_key = 'p:' || d.id;

alter table app_settings  enable row level security;
alter table spec_cache    enable row level security;
alter table build_targets enable row level security;
alter table ai_reasons    enable row level security;
alter table ai_usage      enable row level security;
alter table ranking_runs  enable row level security;
alter table ranking_items enable row level security;

revoke execute on function bump_ai_usage(text, boolean, integer) from public, anon, authenticated;
grant execute on function bump_ai_usage(text, boolean, integer) to service_role;
grant select on deal_listings_ranked to service_role;
