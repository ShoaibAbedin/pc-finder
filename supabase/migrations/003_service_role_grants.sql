-- Newer Supabase projects don't auto-grant API access to tables created via SQL.
-- Grant the server-only service_role (secret key) access. anon/authenticated (public keys) get nothing.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function mark_missing_products(text, text[], timestamptz, integer) to service_role;
grant execute on function expire_ozbargain_deals(integer) to service_role;

-- Future tables (later phases) get the same grants automatically.
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
