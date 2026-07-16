begin;

-- Profiles are synchronized by trusted server-side flows.
-- Authenticated clients must not directly update authorization data.
revoke update
on table public.profiles
from authenticated;

-- Preserve the row-ownership boundary explicitly.
-- Column security is enforced by the UPDATE revoke above.
alter policy "profiles_update_own_or_admin"
on public.profiles
to authenticated
using (
  (select auth.uid()) = id
  or (select public.is_admin())
)
with check (
  (select auth.uid()) = id
  or (select public.is_admin())
);

commit;
