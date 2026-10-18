create or replace function public.delete_wish(p_wish_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.wishes
  where id = p_wish_id and owner_id = auth.uid();

  if not found then raise exception 'wish not found or forbidden'; end if;
end;
$$;

grant execute on function public.delete_wish(uuid) to authenticated;
