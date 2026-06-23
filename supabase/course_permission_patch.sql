-- Course purchase permission patch
-- Run this in Supabase SQL Editor to update table grants without applying the full schema.

grant select on public.courses to anon, authenticated;
grant select on public.course_modules to anon, authenticated;

grant select on public.course_purchases to authenticated;
revoke insert, update, delete on public.course_purchases from anon, authenticated;

grant select on public.lesson_progress to authenticated;
grant insert, update on public.lesson_progress to authenticated;

-- These tables contain protected paid content or private links.
-- Do not grant public/authenticated select directly.
revoke all on public.course_lessons from anon, authenticated;
revoke all on public.lesson_assets from anon, authenticated;
revoke all on public.course_group_links from anon, authenticated;

-- Server-side trusted APIs need full access.
grant all on public.courses to service_role;
grant all on public.course_purchases to service_role;
grant all on public.course_modules to service_role;
grant all on public.course_lessons to service_role;
grant all on public.lesson_assets to service_role;
grant all on public.lesson_progress to service_role;
grant all on public.course_group_links to service_role;
