-- Phase 1 schema: retailers, products, price history, OzBargain deals, scrape run log.
-- All prices are integer cents (AUD).

create table if not exists retailers (
  id               text primary key,
  name             text not null,
  website          text not null,
  kind             text not null check (kind in ('retailer', 'aggregator')),
  melbourne_pickup boolean not null default false,  -- click & collect available in Melbourne
  shipping_notes   text,
  enabled          boolean not null default true,
  created_at       timestamptz not null default now()
);

create table if not exists products (
  id                       bigint generated always as identity primary key,
  retailer_id              text not null references retailers(id),
  external_id              text not null,
  sku                      text,
  title                    text not null,
  url                      text not null,
  category                 text not null,
  brand                    text,
  image_url                text,
  current_price_cents      integer,
  retailer_was_price_cents integer,              -- reference only; discounts use price_history
  in_stock                 boolean,
  status                   text not null default 'active'
                             check (status in ('active', 'out_of_stock', 'expired')),
  missed_runs              integer not null default 0,
  first_seen_at            timestamptz not null default now(),
  last_seen_at             timestamptz not null default now(),
  last_changed_at          timestamptz not null default now(),
  expired_at               timestamptz,
  unique (retailer_id, external_id)
);
create index if not exists products_category_status_idx on products (category, status);
create index if not exists products_retailer_status_idx on products (retailer_id, status, category);

-- One row per observed change in price or stock (not per scrape) to stay small on the free tier.
create table if not exists price_history (
  id          bigint generated always as identity primary key,
  product_id  bigint not null references products(id) on delete cascade,
  price_cents integer,
  in_stock    boolean,
  recorded_at timestamptz not null default now()
);
create index if not exists price_history_product_time_idx on price_history (product_id, recorded_at desc);

create table if not exists ozbargain_deals (
  node_id       text primary key,
  title         text not null,
  link          text not null,
  deal_url      text,
  store         text,
  retailer_id   text references retailers(id),
  price_cents   integer,
  category      text not null default 'other',
  tags          text[] not null default '{}',
  votes_pos     integer not null default 0,
  votes_neg     integer not null default 0,
  comment_count integer not null default 0,
  image_url     text,
  posted_at     timestamptz,
  expires_at    timestamptz,
  status        text not null default 'active' check (status in ('active', 'expired')),
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expired_at    timestamptz
);
create index if not exists ozbargain_deals_status_idx on ozbargain_deals (status, category, posted_at desc);

create table if not exists scrape_runs (
  id            bigint generated always as identity primary key,
  source_id     text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running'
                  check (status in ('running', 'ok', 'partial', 'blocked', 'error')),
  items_found   integer not null default 0,
  items_new     integer not null default 0,
  items_changed integer not null default 0,
  items_expired integer not null default 0,
  requests      integer not null default 0,
  message       text
);
create index if not exists scrape_runs_source_time_idx on scrape_runs (source_id, started_at desc);

-- Lock everything down: no anon/public access. Only the service-role key (server-side) can read/write.
alter table retailers       enable row level security;
alter table products        enable row level security;
alter table price_history   enable row level security;
alter table ozbargain_deals enable row level security;
alter table scrape_runs     enable row level security;

-- Products of a retailer, in fully-scraped categories, not seen in this run → missed_runs + 1.
-- Expire once missed_runs reaches the threshold. Returns number newly expired.
create or replace function mark_missing_products(
  p_retailer_id text,
  p_categories  text[],
  p_seen_before timestamptz,
  p_threshold   integer
) returns integer
language sql
as $$
  with bumped as (
    update products
       set missed_runs = missed_runs + 1,
           status      = case when missed_runs + 1 >= p_threshold then 'expired' else status end,
           expired_at  = case when missed_runs + 1 >= p_threshold then now() else expired_at end
     where retailer_id = p_retailer_id
       and category = any (p_categories)
       and last_seen_at < p_seen_before
       and status <> 'expired'
    returning status
  )
  select count(*)::integer from bumped where status = 'expired';
$$;

-- Expire OzBargain posts past their expiry date, or older than p_stale_days with no expiry date.
create or replace function expire_ozbargain_deals(p_stale_days integer)
returns integer
language sql
as $$
  with e as (
    update ozbargain_deals
       set status = 'expired', expired_at = now()
     where status = 'active'
       and (
         expires_at < now()
         or (expires_at is null and posted_at < now() - make_interval(days => p_stale_days))
       )
    returning 1
  )
  select count(*)::integer from e;
$$;

revoke execute on function mark_missing_products(text, text[], timestamptz, integer) from public, anon, authenticated;
revoke execute on function expire_ozbargain_deals(integer) from public, anon, authenticated;
