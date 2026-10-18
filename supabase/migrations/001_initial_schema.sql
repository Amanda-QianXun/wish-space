-- Wish Space: multi-account schema, permissions and RPCs
create extension if not exists pgcrypto;

create type public.wish_kind as enum ('inspiration', 'exact');
create type public.wish_status as enum ('active', 'fulfilled');
create type public.claim_state as enum ('reserved', 'purchased');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 16),
  color text not null default '#D9796F',
  birthday text,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 30),
  emoji text not null default '✨',
  owner_id uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  color text not null default '#D9796F',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  kind public.wish_kind not null,
  status public.wish_status not null default 'active',
  priority smallint not null default 3 check (priority between 1 and 5),
  category text not null default '生活好物',
  budget_min numeric(10,2),
  budget_max numeric(10,2),
  platform text,
  price numeric(10,2),
  url text,
  note text,
  style_note text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wish_groups (
  wish_id uuid not null references public.wishes(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  platform text,
  price numeric(10,2),
  url text,
  note text,
  primary key (wish_id, group_id)
);

create table public.gift_claims (
  wish_id uuid not null,
  group_id uuid not null,
  claimed_by uuid not null references public.profiles(id) on delete cascade,
  state public.claim_state not null default 'reserved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (wish_id, group_id),
  foreign key (wish_id, group_id) references public.wish_groups(wish_id, group_id) on delete cascade
);

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.wishes enable row level security;
alter table public.wish_groups enable row level security;
alter table public.gift_claims enable row level security;

create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.group_members where group_id = p_group_id and user_id = p_user_id);
$$;

create policy "profiles visible to self and group peers" on public.profiles for select to authenticated
using (id = auth.uid() or exists (
  select 1 from public.group_members mine
  join public.group_members theirs on theirs.group_id = mine.group_id
  where mine.user_id = auth.uid() and theirs.user_id = profiles.id
));
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "members view groups" on public.groups for select to authenticated using (public.is_group_member(id));
create policy "members view memberships" on public.group_members for select to authenticated using (public.is_group_member(group_id));
create policy "visible wishes" on public.wishes for select to authenticated using (
  owner_id = auth.uid() or exists (
    select 1 from public.wish_groups wg where wg.wish_id = wishes.id and public.is_group_member(wg.group_id)
  )
);
create policy "visible wish group records" on public.wish_groups for select to authenticated using (public.is_group_member(group_id));
create policy "claims hidden from wish owners" on public.gift_claims for select to authenticated using (
  public.is_group_member(group_id)
  and not exists (select 1 from public.wishes w where w.id = wish_id and w.owner_id = auth.uid())
);

create or replace function public.setup_profile(p_nickname text)
returns void language plpgsql security definer set search_path = public as $$
declare palette text[] := array['#E9A59C','#8FB8A8','#A9A2D4','#D8A667','#7EA8C3','#C590AA'];
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into public.profiles(id, nickname, color)
  values (auth.uid(), trim(p_nickname), palette[1 + floor(random() * array_length(palette, 1))::int])
  on conflict (id) do update set nickname = excluded.nickname;
end;
$$;

create or replace function public.get_app_state()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); result jsonb;
begin
  if uid is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.profiles where id = uid) then
    return jsonb_build_object('needsProfile', true, 'currentUserId', uid);
  end if;

  select jsonb_build_object(
    'currentUserId', uid,
    'profiles', coalesce((
      select jsonb_agg(distinct jsonb_build_object('id', p.id, 'nickname', p.nickname, 'color', p.color, 'birthday', p.birthday))
      from public.profiles p
      where p.id = uid or exists (
        select 1 from public.group_members mine join public.group_members theirs on mine.group_id = theirs.group_id
        where mine.user_id = uid and theirs.user_id = p.id
      )
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'name', g.name, 'emoji', g.emoji, 'inviteCode', g.invite_code,
        'members', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'color', gm2.color, 'birthday', p.birthday) order by gm2.joined_at), '[]'::jsonb)
                    from public.group_members gm2 join public.profiles p on p.id = gm2.user_id where gm2.group_id = g.id)
      ) order by g.created_at)
      from public.groups g join public.group_members gm on gm.group_id = g.id where gm.user_id = uid
    ), '[]'::jsonb),
    'wishes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'ownerId', w.owner_id, 'title', w.title, 'kind', w.kind, 'status', w.status,
        'priority', w.priority, 'category', w.category, 'budgetMin', w.budget_min, 'budgetMax', w.budget_max,
        'platform', w.platform, 'price', w.price, 'url', w.url, 'note', w.note, 'styleNote', w.style_note,
        'image', w.image_url, 'createdAt', w.created_at,
        'groupIds', (select coalesce(jsonb_agg(wg.group_id), '[]'::jsonb) from public.wish_groups wg where wg.wish_id = w.id),
        'overrides', (select coalesce(jsonb_agg(jsonb_build_object('groupId', wg.group_id, 'platform', wg.platform, 'price', wg.price, 'url', wg.url, 'note', wg.note)), '[]'::jsonb) from public.wish_groups wg where wg.wish_id = w.id)
      ) order by w.created_at desc)
      from public.wishes w
      where w.owner_id = uid or exists(select 1 from public.wish_groups wg where wg.wish_id = w.id and public.is_group_member(wg.group_id, uid))
    ), '[]'::jsonb),
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object('wishId', c.wish_id, 'groupId', c.group_id, 'claimedBy', c.claimed_by, 'state', c.state))
      from public.gift_claims c join public.wishes w on w.id = c.wish_id
      where public.is_group_member(c.group_id, uid) and w.owner_id <> uid
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.create_group(p_name text, p_emoji text default '✨')
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid := gen_random_uuid(); code text;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id = auth.uid()) then raise exception 'profile required'; end if;
  loop
    code := 'WISH-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4));
    exit when not exists(select 1 from public.groups where invite_code = code);
  end loop;
  insert into public.groups(id, name, emoji, owner_id, invite_code) values(gid, trim(p_name), coalesce(nullif(p_emoji,''),'✨'), auth.uid(), code);
  insert into public.group_members(group_id, user_id, role, color)
  select gid, p.id, 'owner', p.color from public.profiles p where p.id = auth.uid();
  return gid;
end;
$$;

create or replace function public.join_group(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid; member_color text;
begin
  select id into gid from public.groups where invite_code = upper(trim(p_code));
  if gid is null then raise exception 'invalid invite code'; end if;
  select color into member_color from public.profiles where id = auth.uid();
  insert into public.group_members(group_id, user_id, color) values(gid, auth.uid(), member_color) on conflict do nothing;
  return gid;
end;
$$;

create or replace function public.create_wish(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare wid uuid := gen_random_uuid(); gid_text text;
begin
  insert into public.wishes(id, owner_id, title, kind, priority, category, budget_min, budget_max, platform, price, url, note, style_note, image_url)
  values(wid, auth.uid(), p_payload->>'title', (p_payload->>'kind')::public.wish_kind,
    coalesce((p_payload->>'priority')::smallint,3), coalesce(p_payload->>'category','生活好物'),
    nullif(p_payload->>'budgetMin','')::numeric, nullif(p_payload->>'budgetMax','')::numeric,
    nullif(p_payload->>'platform',''), nullif(p_payload->>'price','')::numeric, nullif(p_payload->>'url',''),
    nullif(p_payload->>'note',''), nullif(p_payload->>'styleNote',''), nullif(p_payload->>'image',''));
  for gid_text in select jsonb_array_elements_text(p_payload->'groupIds') loop
    if not public.is_group_member(gid_text::uuid, auth.uid()) then raise exception 'not a group member'; end if;
    insert into public.wish_groups(wish_id, group_id) values(wid, gid_text::uuid);
  end loop;
  return wid;
end;
$$;

create or replace function public.set_wish_status(p_wish_id uuid, p_status public.wish_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.wishes set status = p_status, updated_at = now() where id = p_wish_id and owner_id = auth.uid();
  if not found then raise exception 'wish not found or forbidden'; end if;
end;
$$;

create or replace function public.set_gift_claim(p_wish_id uuid, p_group_id uuid, p_state public.claim_state)
returns void language plpgsql security definer set search_path = public as $$
declare wish_owner uuid;
begin
  select owner_id into wish_owner from public.wishes where id = p_wish_id;
  if wish_owner = auth.uid() then raise exception 'owners cannot claim their own wish'; end if;
  if not public.is_group_member(p_group_id, auth.uid()) or not exists(select 1 from public.wish_groups where wish_id = p_wish_id and group_id = p_group_id) then raise exception 'forbidden'; end if;
  if p_state is null then
    delete from public.gift_claims where wish_id = p_wish_id and group_id = p_group_id and claimed_by = auth.uid();
  else
    insert into public.gift_claims(wish_id, group_id, claimed_by, state)
    values(p_wish_id, p_group_id, auth.uid(), p_state)
    on conflict (wish_id, group_id) do update set state = excluded.state, updated_at = now()
    where public.gift_claims.claimed_by = auth.uid();
  end if;
end;
$$;

revoke all on all tables in schema public from anon;
grant select on public.profiles, public.groups, public.group_members, public.wishes, public.wish_groups, public.gift_claims to authenticated;
grant execute on function public.setup_profile(text) to authenticated;
grant execute on function public.get_app_state() to authenticated;
grant execute on function public.create_group(text,text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.create_wish(jsonb) to authenticated;
grant execute on function public.set_wish_status(uuid,public.wish_status) to authenticated;
grant execute on function public.set_gift_claim(uuid,uuid,public.claim_state) to authenticated;
