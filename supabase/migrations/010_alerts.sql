-- Price alerts (push notifications via the free ntfy app; no account needed).

create table if not exists alert_settings (
  id                  integer primary key default 1 check (id = 1),
  -- private ntfy channel name; long and random so nobody else can guess it
  ntfy_topic          text not null default ('pcfinder-' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
  notify_build        boolean not null default true,
  build_drop_cents    integer not null default 5000,   -- alert when best build total drops by ≥ $50
  notify_top_picks    boolean not null default true,
  top_pick_drop_pct   integer not null default 10,     -- alert when a top pick drops ≥ 10% vs our history
  updated_at          timestamptz not null default now()
);
insert into alert_settings (id) values (1) on conflict (id) do nothing;

create table if not exists alert_watches (
  id              bigint generated always as identity primary key,
  query           text not null,          -- words that must all appear in the title, e.g. "rtx 5070"
  category        text,                   -- optional category filter
  max_price_cents integer not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- One row per notification sent, so the same deal isn't announced twice.
create table if not exists alert_log (
  alert_key text primary key,
  title     text not null,
  body      text,
  url       text,
  sent_at   timestamptz not null default now()
);
create index if not exists alert_log_sent_idx on alert_log (sent_at desc);

alter table alert_settings enable row level security;
alter table alert_watches  enable row level security;
alter table alert_log      enable row level security;
grant select, insert, update, delete on alert_settings, alert_watches, alert_log to service_role;
grant usage, select on all sequences in schema public to service_role;
