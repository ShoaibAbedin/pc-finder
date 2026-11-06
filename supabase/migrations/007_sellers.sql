-- Aggregator listings (StaticICE) come from many stores: record the actual seller per product.
alter table products add column if not exists seller_name text;
alter table products add column if not exists seller_vic boolean; -- seller has a Victorian store (pickup likely)

-- Recreate views so they expose the seller (views depending on deal_listings must be dropped first).
drop view if exists deal_listings_ranked;
drop view if exists deal_listings;

create view deal_listings with (security_invoker = true) as
select p.id,
       p.retailer_id,
       coalesce(p.seller_name, r.name)              as retailer_name,
       coalesce(p.seller_vic, r.melbourne_pickup)   as melbourne_pickup,
       p.seller_name,
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
       p.title_hash,
       prev.price_cents      as prev_price_cents,
       cur.since             as current_price_since,
       stats.low_30d_cents,
       stats.high_30d_cents,
       stats.history_points,
       case when prev.price_cents > p.current_price_cents
            then prev.price_cents - p.current_price_cents end                         as drop_cents,
       case when prev.price_cents > p.current_price_cents
            then round(100.0 * (prev.price_cents - p.current_price_cents) / prev.price_cents, 1) end as drop_pct,
       (prev.price_cents > p.current_price_cents and cur.since >= rt.last_ok_start)   as price_dropped,
       (p.first_seen_at >= rt.last_ok_start and p.first_seen_at > rt.first_ok_finish) as is_new,
       (stats.history_points > 1 and p.current_price_cents <= stats.low_30d_cents)    as is_30d_low
  from products p
  join retailers r on r.id = p.retailer_id
  left join source_run_times rt on rt.source_id = p.retailer_id
  left join lateral (
        select ph.price_cents, ph.recorded_at
          from price_history ph
         where ph.product_id = p.id
           and ph.price_cents is not null
           and ph.price_cents <> p.current_price_cents
         order by ph.recorded_at desc
         limit 1
       ) prev on true
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

create view deal_listings_ranked with (security_invoker = true) as
with latest as (select max(id) as id from ranking_runs)
select d.*, ri.score as match_score
  from deal_listings d
  left join ranking_items ri
         on ri.run_id = (select id from latest)
        and ri.item_key = 'p:' || d.id;

grant select on deal_listings, deal_listings_ranked to service_role;
