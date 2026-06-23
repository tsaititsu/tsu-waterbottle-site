-- WATERBOTTLE course system schema patch
-- Paste this file into Supabase SQL Editor to add the course tables only.

create extension if not exists pgcrypto;

create table if not exists public.courses (
  id text primary key,
  title text not null,
  subtitle text,
  description text,
  price integer not null,
  level integer not null,
  prerequisite_course_id text references public.courses(id),
  group_name text,
  group_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.course_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  payment_id uuid,
  status text not null default 'paid',
  purchased_at timestamptz default now(),
  unique(user_id, course_id)
);

create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  sort_order integer default 0,
  is_published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  content text,
  video_storage_path text,
  video_embed_url text,
  sort_order integer default 0,
  duration_minutes integer,
  is_free_preview boolean default false,
  is_published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.lesson_assets (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  file_name text not null,
  file_type text,
  storage_path text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  completed boolean default false,
  completed_at timestamptz,
  updated_at timestamptz default now(),
  unique(user_id, lesson_id)
);

create table if not exists public.course_group_links (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  group_name text not null,
  group_url text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  );
$$;

drop trigger if exists courses_touch_updated_at on public.courses;
create trigger courses_touch_updated_at
before update on public.courses
for each row execute function public.touch_updated_at();

drop trigger if exists course_modules_touch_updated_at on public.course_modules;
create trigger course_modules_touch_updated_at
before update on public.course_modules
for each row execute function public.touch_updated_at();

drop trigger if exists course_lessons_touch_updated_at on public.course_lessons;
create trigger course_lessons_touch_updated_at
before update on public.course_lessons
for each row execute function public.touch_updated_at();

drop trigger if exists lesson_progress_touch_updated_at on public.lesson_progress;
create trigger lesson_progress_touch_updated_at
before update on public.lesson_progress
for each row execute function public.touch_updated_at();

drop trigger if exists course_group_links_touch_updated_at on public.course_group_links;
create trigger course_group_links_touch_updated_at
before update on public.course_group_links
for each row execute function public.touch_updated_at();

create index if not exists courses_level_idx on public.courses(level);
create index if not exists course_purchases_user_id_idx on public.course_purchases(user_id);
create index if not exists course_purchases_course_id_idx on public.course_purchases(course_id);
create index if not exists course_modules_course_id_sort_order_idx on public.course_modules(course_id, sort_order);
create index if not exists course_lessons_course_id_sort_order_idx on public.course_lessons(course_id, sort_order);
create index if not exists course_lessons_module_id_sort_order_idx on public.course_lessons(module_id, sort_order);
create index if not exists lesson_assets_lesson_id_sort_order_idx on public.lesson_assets(lesson_id, sort_order);
create index if not exists lesson_progress_user_id_idx on public.lesson_progress(user_id);
create index if not exists course_group_links_course_id_idx on public.course_group_links(course_id);

alter table public.courses enable row level security;
alter table public.course_purchases enable row level security;
alter table public.course_modules enable row level security;
alter table public.course_lessons enable row level security;
alter table public.lesson_assets enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.course_group_links enable row level security;

drop policy if exists "public_read_active_courses" on public.courses;
drop policy if exists "admin_manage_courses" on public.courses;
drop policy if exists "course_purchases_select_own" on public.course_purchases;
drop policy if exists "Users can insert own course purchases" on public.course_purchases;
drop policy if exists "admin_manage_course_purchases" on public.course_purchases;
drop policy if exists "course_purchases_select_own_or_admin" on public.course_purchases;
drop policy if exists "course_modules_select_published_or_admin" on public.course_modules;
drop policy if exists "admin_manage_course_modules" on public.course_modules;
drop policy if exists "Anyone can read published course lessons" on public.course_lessons;
drop policy if exists "course_lessons_select_preview_published_or_admin" on public.course_lessons;
drop policy if exists "admin_manage_course_lessons" on public.course_lessons;
drop policy if exists "lesson_assets_select_admin" on public.lesson_assets;
drop policy if exists "admin_manage_lesson_assets" on public.lesson_assets;
drop policy if exists "lesson_progress_select_own_or_admin" on public.lesson_progress;
drop policy if exists "lesson_progress_select_own" on public.lesson_progress;
drop policy if exists "lesson_progress_insert_own" on public.lesson_progress;
drop policy if exists "lesson_progress_update_own_or_admin" on public.lesson_progress;
drop policy if exists "lesson_progress_update_own" on public.lesson_progress;
drop policy if exists "course_group_links_select_purchased_or_admin" on public.course_group_links;
drop policy if exists "admin_manage_course_group_links" on public.course_group_links;

create policy "public_read_active_courses" on public.courses
for select using (is_active = true or public.is_admin());

create policy "admin_manage_courses" on public.courses
for all using (public.is_admin()) with check (public.is_admin());

create policy "course_purchases_select_own" on public.course_purchases
for select using (auth.uid() = user_id);

create policy "course_modules_select_published_or_admin" on public.course_modules
for select using (is_published = true or public.is_admin());

create policy "admin_manage_course_modules" on public.course_modules
for all using (public.is_admin()) with check (public.is_admin());

create policy "admin_manage_course_lessons" on public.course_lessons
for all using (public.is_admin()) with check (public.is_admin());

create policy "admin_manage_lesson_assets" on public.lesson_assets
for all using (public.is_admin()) with check (public.is_admin());

create policy "lesson_progress_select_own" on public.lesson_progress
for select using (auth.uid() = user_id);

create policy "lesson_progress_insert_own" on public.lesson_progress
for insert with check (auth.uid() = user_id);

create policy "lesson_progress_update_own" on public.lesson_progress
for update using (auth.uid() = user_id);

create policy "admin_manage_course_group_links" on public.course_group_links
for all using (public.is_admin()) with check (public.is_admin());

insert into public.courses (
  id,
  title,
  subtitle,
  description,
  price,
  level,
  prerequisite_course_id,
  group_name,
  group_url,
  is_active
) values
(
  'basic',
  '初級班',
  '小白專區',
  '適合完全不懂紫微斗數的人，從基礎觀念、十二宮、十四主星、四化與流年大限入門開始學。',
  9800,
  1,
  null,
  '初級班課程群組',
  null,
  true
),
(
  'advanced',
  '進階班',
  '四宮實戰應用',
  '學習夫妻宮、官祿宮、財帛宮、僕役宮、田宅宮、暗合連動與進階解盤技巧。',
  9800,
  2,
  'basic',
  '進階班課程群組',
  null,
  true
),
(
  'master',
  '高階班',
  '飛化與占卜實戰',
  '學習福德宮、疾厄宮、高階占卜技巧、飛化技巧與實戰案例拆解。',
  9800,
  3,
  'advanced',
  '高階班課程群組',
  null,
  true
)
on conflict (id) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  price = excluded.price,
  level = excluded.level,
  prerequisite_course_id = excluded.prerequisite_course_id,
  group_name = excluded.group_name,
  group_url = excluded.group_url,
  is_active = excluded.is_active,
  updated_at = now();
