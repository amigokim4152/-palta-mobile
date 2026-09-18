-- PostGIS installs these SECURITY DEFINER helpers in public. Palta clients do
-- not need them through PostgREST, so remove PUBLIC/client execution while
-- retaining trusted backend access. Do not move the PostGIS extension or alter
-- spatial_ref_sys here; those are extension-owned objects.

revoke execute on function public.st_estimatedextent(text, text)
  from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text)
  from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text, boolean)
  from public, anon, authenticated;

grant execute on function public.st_estimatedextent(text, text)
  to service_role;
grant execute on function public.st_estimatedextent(text, text, text)
  to service_role;
grant execute on function public.st_estimatedextent(text, text, text, boolean)
  to service_role;
