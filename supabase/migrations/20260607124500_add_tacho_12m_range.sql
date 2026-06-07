create or replace function public.resolve_tacho_range_start(p_range text)
returns timestamptz
language sql
stable
as $$
  select case p_range
    when '30d' then now() - interval '30 days'
    when '3m' then now() - interval '3 months'
    when '6m' then now() - interval '6 months'
    when '12m' then now() - interval '12 months'
    else now() - interval '7 days'
  end;
$$;
