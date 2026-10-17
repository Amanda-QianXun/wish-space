create or replace function public.update_wish(p_wish_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare gid_text text;
begin
  update public.wishes set
    title = p_payload->>'title',
    kind = (p_payload->>'kind')::public.wish_kind,
    priority = coalesce((p_payload->>'priority')::smallint, 3),
    category = coalesce(p_payload->>'category', '生活好物'),
    budget_min = nullif(p_payload->>'budgetMin', '')::numeric,
    budget_max = nullif(p_payload->>'budgetMax', '')::numeric,
    platform = nullif(p_payload->>'platform', ''),
    price = nullif(p_payload->>'price', '')::numeric,
    url = nullif(p_payload->>'url', ''),
    note = nullif(p_payload->>'note', ''),
    style_note = nullif(p_payload->>'styleNote', ''),
    image_url = nullif(p_payload->>'image', ''),
    updated_at = now()
  where id = p_wish_id and owner_id = auth.uid();

  if not found then raise exception 'wish not found or forbidden'; end if;

  delete from public.wish_groups where wish_id = p_wish_id;
  for gid_text in select jsonb_array_elements_text(p_payload->'groupIds') loop
    if not public.is_group_member(gid_text::uuid, auth.uid()) then raise exception 'not a group member'; end if;
    insert into public.wish_groups(wish_id, group_id) values(p_wish_id, gid_text::uuid);
  end loop;
end;
$$;

grant execute on function public.update_wish(uuid, jsonb) to authenticated;
