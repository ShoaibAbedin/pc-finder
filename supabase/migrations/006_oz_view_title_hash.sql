-- Recreate so `d.*` picks up the new title_hash column.
drop view if exists oz_deal_listings;
create view oz_deal_listings with (security_invoker = true) as
select d.*,
       r.name as retailer_name,
       r.melbourne_pickup,
       (d.first_seen_at >= rt.last_ok_start and d.first_seen_at > rt.first_ok_finish) as is_new
  from ozbargain_deals d
  left join retailers r on r.id = d.retailer_id
  left join source_run_times rt on rt.source_id = 'ozbargain';
grant select on oz_deal_listings to service_role;
