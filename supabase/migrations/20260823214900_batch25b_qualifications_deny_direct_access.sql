-- Driver licence entitlements are exposed only through guarded manager RPCs.
create policy "No direct driver vehicle qualification access"
on public.driver_vehicle_qualifications
as restrictive
for all
to authenticated
using (false)
with check (false);
