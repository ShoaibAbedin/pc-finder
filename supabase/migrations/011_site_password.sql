-- Password login for the site (replaces needing the long unlock link).
-- Only a salted scrypt hash is stored. Failed attempts are logged to rate-limit guessing.
create table if not exists site_auth (
  id smallint primary key default 1 check (id = 1),
  salt text not null,
  hash text not null,
  updated_at timestamptz not null default now()
);
alter table site_auth enable row level security;

create table if not exists site_login_failures (
  id bigserial primary key,
  at timestamptz not null default now()
);
create index if not exists site_login_failures_at on site_login_failures (at);
alter table site_login_failures enable row level security;

grant all on site_auth, site_login_failures to service_role;
grant usage, select on sequence site_login_failures_id_seq to service_role;
