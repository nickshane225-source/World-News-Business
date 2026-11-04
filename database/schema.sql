-- Run this whole file in Supabase > SQL Editor
create extension if not exists pgcrypto;

create table if not exists automation_settings (
  id int primary key default 1 check (id = 1),
  automation_enabled boolean not null default true,
  mode text not null default 'auto' check (mode in ('approval','auto')),
  daily_target int not null default 10,
  active_from int not null default 7,
  active_to int not null default 22,
  model text not null default 'gemini-3.6-flash',
  niche text not null default 'USA news, technology and trending topics',
  generate_images boolean not null default true
);
insert into automation_settings (id) values (1) on conflict do nothing;

create table if not exists trending_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  keyword text,
  angle text,
  category text,
  score int default 50,
  source text,
  status text not null default 'new', -- new | generating | used | failed | rejected
  created_at timestamptz not null default now()
);

create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  meta_title text,
  meta_description text,
  focus_keyword text,
  secondary_keywords text[] default '{}',
  excerpt text,
  content_html text not null,
  faqs jsonb not null default '[]',
  category text,
  featured_image_url text,
  image_alt text,
  -- DRAFT | PENDING_APPROVAL | APPROVED | SCHEDULED | PUBLISHED | ARCHIVED
  status text not null default 'PENDING_APPROVAL',
  scheduled_at timestamptz,
  published_at timestamptz,
  topic_id uuid references trending_topics(id) on delete set null,
  word_count int default 0,
  quality_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists articles_status_idx on articles (status, published_at desc);
create index if not exists articles_created_idx on articles (created_at desc);

create table if not exists article_sources (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  title text,
  url text not null
);

create table if not exists generation_logs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  topic text,
  model text,
  ok boolean not null,
  error text,
  duration_ms int,
  created_at timestamptz not null default now()
);

-- Server uses the service-role key (bypasses RLS). Lock the tables from public access:
alter table automation_settings enable row level security;
alter table trending_topics enable row level security;
alter table articles enable row level security;
alter table article_sources enable row level security;
alter table generation_logs enable row level security;

-- Public bucket for generated featured images
insert into storage.buckets (id, name, public) values ('media','media', true) on conflict do nothing;
