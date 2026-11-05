-- Read-side views for the website. All indicators come from OUR price history, never retailer "was" prices.

-- Per-source run times: used for "New" / "Price dropped since last update".
create or replace view source_run_times with (security_invoker = true) as
select source_id,
       max(started_at)  filter (where status in ('ok', 'partial')) as last_ok_start,
       max(finished_at) filter (where status in ('ok', 'partial')) as last_ok_finish,
       min(finished_at) filter (where status in ('ok', 'partial')) as first_ok_finish
  from scrape_runs
 group by source_id;

create or replace view deal_listings with (security_invoker = true) as
select p.id,
       p.retailer_id,
       r.name                as retailer_name,
       r.melbourne_pickup,
       p.external_id,
       p.title,
       p.url,
       p.category,
       p.brand,
       p.image_url,
       p.current_price_cents,
       p.in_stock,
       p.status,
       p.first_seen_at,
       p.last_seen_at,
       p.last_changed_at,
       prev.price_cents      as prev_price_cents,
       cur.since             as current_price_since,
       stats.low_30d_cents,
       stats.high_30d_cents,
       stats.history_points,
       case when prev.price_cents > p.current_price_cents
            then prev.price_cents - p.current_price_cents end                         as drop_cents,
       case when prev.price_cents > p.current_price_cents
            then round(100.0 * (prev.price_cents - p.current_price_cents) / prev.price_cents, 1) end as drop_pct,
       -- dropped during the most recent successful update
       (prev.price_cents > p.current_price_cents and cur.since >= rt.last_ok_start)   as price_dropped,
       -- first appeared in the most recent update (but not part of the very first import)
       (p.first_seen_at >= rt.last_ok_start and p.first_seen_at > rt.first_ok_finish) as is_new,
       -- at or below the lowest price we've seen in 30 days, with enough history to mean something
       (stats.history_points > 1 and p.current_price_cents <= stats.low_30d_cents)    as is_30d_low
  from products p
  join retailers r on r.id = p.retailer_id
  left join source_run_times rt on rt.source_id = p.retailer_id
  -- most recent price that differs from the current one
  left join lateral (
        select ph.price_cents, ph.recorded_at
          from price_history ph
         where ph.product_id = p.id
           and ph.price_cents is not null
           and ph.price_cents <> p.current_price_cents
         order by ph.recorded_at desc
         limit 1
       ) prev on true
  -- when the current price started
  left join lateral (
        select min(ph.recorded_at) as since
          from price_history ph
         where ph.product_id = p.id
           and ph.recorded_at > coalesce(prev.recorded_at, '-infinity'::timestamptz)
       ) cur on true
  left join lateral (
        select min(ph.price_cents) as low_30d_cents,
               max(ph.price_cents) as high_30d_cents,
               count(*)::integer   as history_points
          from price_history ph
         where ph.product_id = p.id
           and ph.price_cents is not null
           and ph.recorded_at > now() - interval '30 days'
       ) stats on true;

create or replace view oz_deal_listings with (security_invoker = true) as
select d.*,
       r.name as retailer_name,
       r.melbourne_pickup,
       (d.first_seen_at >= rt.last_ok_start and d.first_seen_at > rt.first_ok_finish) as is_new
  from ozbargain_deals d
  left join retailers r on r.id = d.retailer_id
  left join source_run_times rt on rt.source_id = 'ozbargain';

create or replace view retailer_stats with (security_invoker = true) as
select r.id, r.name, r.melbourne_pickup, r.kind,
       count(p.id) filter (where p.status <> 'expired') as listing_count
  from retailers r
  left join products p on p.retailer_id = r.id
 group by r.id;

grant select on source_run_times, deal_listings, oz_deal_listings, retailer_stats to service_role;
