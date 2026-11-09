-- Home page speed: price drops are computed once per update (not on every page view).
alter table ranking_runs add column if not exists drops jsonb;
