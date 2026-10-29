-- รันไฟล์นี้ใน Supabase Dashboard > SQL Editor
-- และเปิด Authentication > Providers > "Allow anonymous sign-ins"

create table if not exists public.analyses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  draw_date   date not null,
  day_idx     smallint not null check (day_idx between 0 and 6),
  phase       text not null check (phase in ('waxing', 'waning')),
  kham        smallint not null check (kham between 1 and 15),
  top_digits  smallint[] not null,
  core        text[] not null,
  protection  text[] not null,
  trios       text[] not null,
  note        text,
  created_at  timestamptz not null default now()
);

create table if not exists public.draws (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  draw_date   date not null,
  p1          text not null check (p1 ~ '^[0-9]{6}$'),
  p2          text not null check (p2 ~ '^[0-9]{2}$'),
  day_idx     smallint not null check (day_idx between 0 and 6),
  lunar       text not null check (lunar in ('waxing', 'waning')),
  kham        smallint not null check (kham between 1 and 15),
  created_at  timestamptz not null default now(),
  unique (user_id, draw_date)
);

alter table public.analyses enable row level security;
alter table public.draws    enable row level security;

create policy "own analyses" on public.analyses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own draws" on public.draws
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
