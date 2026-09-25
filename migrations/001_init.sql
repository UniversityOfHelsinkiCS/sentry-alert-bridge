create table slack_destinations (
  id            serial primary key,
  label         text not null,
  webhook_url   text not null,
  url_hint      text not null,
  created_at    timestamptz not null default now()
);

create table sentry_projects (
  slug          text primary key,
  name          text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create table routes (
  project_slug   text primary key references sentry_projects(slug) on delete cascade,
  destination_id int not null references slack_destinations(id) on delete restrict,
  enabled        boolean not null default true,
  updated_at     timestamptz not null default now()
);

create table settings (
  id            int primary key default 1 check (id = 1),
  ingest_mode   text not null default 'polling'
                  check (ingest_mode in ('webhook', 'polling')),
  last_poll_at  timestamptz,
  -- false until INGEST_MODE_DEFAULT has been applied once; after that the UI
  -- owns ingest_mode and the env var is ignored.
  seeded        boolean not null default false,
  updated_at    timestamptz not null default now()
);

insert into settings (id) values (1) on conflict do nothing;

create table seen_issues (
  project_slug  text not null,
  issue_id      text not null,
  seen_at       timestamptz not null default now(),
  primary key (project_slug, issue_id)
);

create table deliveries (
  id             bigserial primary key,
  received_at    timestamptz not null default now(),
  source         text not null default 'webhook',
  project_slug   text,
  issue_title    text,
  issue_url      text,
  destination_id int references slack_destinations(id) on delete set null,
  outcome        text not null,
  detail         text
);

create index deliveries_received_at_idx on deliveries (received_at desc);
