-- RPC: atomic replace-all for fund allocations
-- Uses invoker security (RLS applies). Runs as a single transaction.
create or replace function public.replace_fund_allocations(p_allocations jsonb)
returns void
language plpgsql
as $$
declare
  v_user_id uuid;
  v_total numeric := 0;
  v_row jsonb;
  v_name text;
  v_category text;
  v_weight numeric;
  v_apply boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'allocations must be a JSON array';
  end if;

  for v_row in select value from jsonb_array_elements(p_allocations)
  loop
    v_name := nullif(trim(coalesce(v_row->>'fund_name','')), '');
    if v_name is null then
      raise exception 'fund_name is required';
    end if;

    v_category := nullif(trim(coalesce(v_row->>'fund_category','')), '');
    v_weight := (v_row->>'weight_percent')::numeric;
    if v_weight < 0 or v_weight > 100 then
      raise exception 'weight_percent must be between 0 and 100';
    end if;

    v_apply := coalesce((v_row->>'apply_multiplier')::boolean, true);
    v_total := v_total + v_weight;
  end loop;

  if abs(v_total - 100) > 0.0001 then
    raise exception 'Weights must sum to 100%%';
  end if;

  delete from public.fund_allocations where user_id = v_user_id;

  insert into public.fund_allocations (user_id, fund_name, fund_category, weight_percent, apply_multiplier)
  select
    v_user_id,
    nullif(trim(coalesce(x.value->>'fund_name','')), ''),
    nullif(trim(coalesce(x.value->>'fund_category','')), ''),
    (x.value->>'weight_percent')::numeric,
    coalesce((x.value->>'apply_multiplier')::boolean, true)
  from jsonb_array_elements(p_allocations) as x(value);
end;
$$;

revoke all on function public.replace_fund_allocations(jsonb) from public;
grant execute on function public.replace_fund_allocations(jsonb) to authenticated;
grant execute on function public.replace_fund_allocations(jsonb) to service_role;

