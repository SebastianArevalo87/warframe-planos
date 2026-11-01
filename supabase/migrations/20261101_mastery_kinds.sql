alter table public.catalog_items drop constraint if exists catalog_items_kind_check;
alter table public.catalog_items add constraint catalog_items_kind_check check (kind in ('warframe', 'primary', 'secondary', 'melee', 'archwing', 'archgun', 'archmelee', 'necramech', 'companion'));

create or replace function public.dashboard_stats()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  col jsonb := '{"parts":[],"built":[],"items":[]}'::jsonb;
  owned_parts text[];
  built_ids text[];
  owned_items text[];
  result jsonb;
begin
  select collection into col from public.profiles where user_id = auth.uid();
  if col is null then
    col := '{"parts":[],"built":[],"items":[]}'::jsonb;
  end if;
  owned_parts := array(select jsonb_array_elements_text(col->'parts'));
  built_ids := array(select jsonb_array_elements_text(col->'built'));
  owned_items := array(select jsonb_array_elements_text(col->'items'));

  with marked as (
    select
      i.id,
      i.name,
      i.kind,
      i.image,
      count(p.id)::int as part_count,
      count(p.id) filter (where p.id = any(owned_parts))::int as owned_count,
      i.id = any(built_ids) or (count(p.id) = 0 and i.id = any(owned_items)) as complete,
      count(p.id) > 0 and i.id <> all(built_ids) and count(p.id) filter (where p.id = any(owned_parts)) = count(p.id) as ready,
      count(p.id) > 0
        and i.id <> all(built_ids)
        and count(p.id) filter (where p.id = any(owned_parts)) > 0
        and count(p.id) - count(p.id) filter (where p.id = any(owned_parts)) between 1 and 2 as almost
    from public.catalog_items i
    left join public.catalog_parts p on p.item_id = i.id
    group by i.id
  ),
  sellable as (
    select item_id, label, qty
    from (
      select distinct on (cp.id)
        cp.item_id,
        cp.short as label,
        public.stock_qty(col, cp.id, cp.id = any(owned_parts)) as qty
      from public.catalog_parts cp
      where (cp.tradable or cp.slug is not null)
        and cp.item_id = any(built_ids)
      order by cp.id, cp.sort_order
    ) parts
    where qty > 0
    union all
    select i.id, 'Ítem', public.stock_qty(col, i.id, i.id = any(owned_items))
    from public.catalog_items i
    where i.slug is not null
      and not exists (select 1 from public.catalog_parts p where p.item_id = i.id)
      and public.stock_qty(col, i.id, i.id = any(owned_items)) > 0
  )
  select jsonb_build_object(
    'frames', count(*) filter (where kind = 'warframe' and complete),
    'frameTotal', count(*) filter (where kind = 'warframe'),
    'weapons', count(*) filter (where kind in ('primary', 'secondary', 'melee') and complete),
    'weaponTotal', count(*) filter (where kind in ('primary', 'secondary', 'melee')),
    'primary', count(*) filter (where kind = 'primary' and complete),
    'primaryTotal', count(*) filter (where kind = 'primary'),
    'secondary', count(*) filter (where kind = 'secondary' and complete),
    'secondaryTotal', count(*) filter (where kind = 'secondary'),
    'melee', count(*) filter (where kind = 'melee' and complete),
    'meleeTotal', count(*) filter (where kind = 'melee'),
    'archwing', count(*) filter (where kind in ('archwing', 'archgun', 'archmelee', 'necramech') and complete),
    'archwingTotal', count(*) filter (where kind in ('archwing', 'archgun', 'archmelee', 'necramech')),
    'companion', count(*) filter (where kind = 'companion' and complete),
    'companionTotal', count(*) filter (where kind = 'companion'),
    'ready', count(*) filter (where ready),
    'almost', count(*) filter (where almost),
    'ownedParts', (select count(*) from public.catalog_parts cp where cp.id = any(owned_parts)),
    'partTotal', (select count(*) from public.catalog_parts),
    'sellCopies', coalesce((select sum(qty) from sellable), 0),
    'sellItemCount', (select count(distinct item_id) from sellable),
    'sellItems', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'kind', kind, 'image', image, 'missing', 0, 'caption', caption
      ) order by copies desc, name)
      from (
        select id, name, kind, image, copies, caption
        from (
          select i.id, i.name, i.kind, i.image, sum(s.qty)::int as copies,
            string_agg(s.label || ' ×' || s.qty::text, ' · ' order by s.label) as caption
          from sellable s
          join public.catalog_items i on i.id = s.item_id
          group by i.id
        ) grouped
        order by copies desc, name
        limit 6
      ) picked
    ), '[]'::jsonb),
    'sourceVersion', (select source_version from public.catalog_meta where id = 1),
    'generatedAt', (select generated_at from public.catalog_meta where id = 1),
    'readyItems', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'kind', kind, 'image', image, 'missing', 0
      ) order by name)
      from (
        select id, name, kind, image from marked where ready order by name limit 6
      ) picked
    ), '[]'::jsonb),
    'almostItems', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'kind', kind, 'image', image, 'missing', part_count - owned_count
      ) order by (part_count - owned_count), name)
      from (
        select id, name, kind, image, part_count, owned_count
        from marked
        where almost
        order by (part_count - owned_count), name
        limit 6
      ) picked
    ), '[]'::jsonb)
  )
  into result
  from marked;

  return result;
end;
$$;

create or replace function public.list_items(
  p_kind text,
  p_query text,
  p_status text,
  p_limit integer default 24,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  col jsonb := '{"parts":[],"built":[],"items":[]}'::jsonb;
  words text[];
  result jsonb;
  page_limit integer := least(greatest(coalesce(p_limit, 24), 1), 60);
  page_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if coalesce(p_kind, 'all') = 'all'
     and length(btrim(coalesce(p_query, ''))) < 2
     and coalesce(p_status, 'missing') not in ('ready', 'built', 'almost', 'owned') then
    return '{"items":[],"total":0}'::jsonb;
  end if;

  select collection into col from public.profiles where user_id = auth.uid();
  if col is null then
    col := '{"parts":[],"built":[],"items":[]}'::jsonb;
  end if;
  words := array_remove(regexp_split_to_array(public.fold(coalesce(p_query, '')), '\s+'), '');

  with owned as (
    select
      array(select jsonb_array_elements_text(col->'parts')) as parts,
      array(select jsonb_array_elements_text(col->'built')) as built,
      array(select jsonb_array_elements_text(col->'items')) as items
  ),
  base as (
    select
      i.id,
      i.name,
      i.kind,
      i.vaulted,
      i.image,
      count(p.id)::int as part_count,
      count(p.id) filter (where p.id = any(o.parts))::int as owned_count,
      i.id = any(o.built) as is_built,
      i.id = any(o.items) as owned_item,
      public.fold(
        i.name || ' ' || coalesce(string_agg(p.title || ' ' || p.short || ' ' || p.english, ' '), '')
      ) as haystack
    from public.catalog_items i
    cross join owned o
    left join public.catalog_parts p on p.item_id = i.id
    where coalesce(p_kind, 'all') = 'all'
      or (p_kind = 'weapon' and i.kind in ('primary', 'secondary', 'melee'))
      or (p_kind = 'archwing' and i.kind in ('archwing', 'archgun', 'archmelee', 'necramech'))
      or i.kind = p_kind
    group by i.id, o.parts, o.built, o.items
  ),
  filtered as (
    select *
    from base
    where (
      coalesce(array_length(words, 1), 0) = 0
      or not exists (
        select 1 from unnest(words) as word
        where haystack not like '%' || word || '%'
      )
    )
    and (
      coalesce(p_status, 'all') = 'all'
      or (
        p_status = 'missing'
        and not (is_built or (part_count = 0 and owned_item))
      )
      or (
        p_status = 'ready'
        and part_count > 0
        and not is_built
        and owned_count = part_count
      )
      or (
        p_status = 'built'
        and (is_built or (part_count = 0 and owned_item))
      )
      or (
        p_status = 'almost'
        and part_count > 0
        and not is_built
        and owned_count > 0
        and part_count - owned_count between 1 and 2
      )
      or (
        p_status = 'owned'
        and owned_count > 0
      )
    )
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'kind', kind,
          'vaulted', vaulted,
          'image', image,
          'partCount', part_count,
          'ownedCount', owned_count,
          'built', is_built,
          'ownedItem', owned_item
        ) order by name
      )
      from (
        select *
        from filtered
        order by name
        limit page_limit
        offset page_offset
      ) page
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

create or replace function public.upsert_catalog(payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  added integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select count(*) into added
  from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) as element
  where not exists (
    select 1 from public.catalog_items where id = element->>'id'
  );

  insert into public.catalog_items (id, name, kind, vaulted, image, tradable, slug, set_slug, updated_at)
  select
    element->>'id',
    element->>'name',
    element->>'kind',
    coalesce((element->>'vaulted')::boolean, false),
    nullif(element->>'image', ''),
    coalesce((element->>'tradable')::boolean, false) or nullif(element->>'slug', '') is not null,
    case
      when right(coalesce(element->>'slug', ''), 4) = '_set' then null
      else nullif(element->>'slug', '')
    end,
    nullif(element->>'setSlug', ''),
    now()
  from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) as element
  where element->>'kind' in ('warframe', 'primary', 'secondary', 'melee', 'archwing', 'archgun', 'archmelee', 'necramech', 'companion')
    and length(coalesce(element->>'id', '')) between 1 and 400
    and length(coalesce(element->>'name', '')) between 1 and 200
  on conflict (id) do update set
    name = excluded.name,
    kind = excluded.kind,
    vaulted = excluded.vaulted,
    image = excluded.image,
    tradable = excluded.tradable or public.catalog_items.tradable,
    slug = coalesce(excluded.slug, public.catalog_items.slug),
    set_slug = coalesce(excluded.set_slug, public.catalog_items.set_slug),
    updated_at = now();

  insert into public.catalog_parts (id, item_id, short, title, english, tradable, slug, image, materials, relics, sort_order)
  select
    part->>'id',
    element->>'id',
    coalesce(part->>'short', ''),
    coalesce(part->>'title', ''),
    coalesce(part->>'english', ''),
    coalesce((part->>'tradable')::boolean, false),
    nullif(part->>'slug', ''),
    nullif(part->>'image', ''),
    case
      when jsonb_typeof(part->'materials') = 'array' then part->'materials'
      else '[]'::jsonb
    end,
    case
      when jsonb_typeof(part->'relics') = 'array' then part->'relics'
      else coalesce((
        select cp.relics
        from public.catalog_parts cp
        where cp.item_id = element->>'id' and cp.id = part->>'id'
      ), '[]'::jsonb)
    end,
    ordinality::integer
  from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) as element
  cross join lateral jsonb_array_elements(coalesce(element->'parts', '[]'::jsonb)) with ordinality as parts(part, ordinality)
  where exists (select 1 from public.catalog_items where id = element->>'id')
    and length(coalesce(part->>'id', '')) between 1 and 400
  on conflict (item_id, id) do update set
    short = excluded.short,
    title = excluded.title,
    english = excluded.english,
    tradable = excluded.tradable,
    slug = coalesce(excluded.slug, public.catalog_parts.slug),
    image = excluded.image,
    materials = case
      when jsonb_array_length(excluded.materials) = 0 then public.catalog_parts.materials
      else excluded.materials
    end,
    relics = excluded.relics,
    sort_order = excluded.sort_order;

  insert into public.catalog_meta (id, source_version, generated_at)
  values (
    1,
    coalesce(payload->>'sourceVersion', ''),
    coalesce((payload->>'generatedAt')::timestamptz, now())
  )
  on conflict (id) do update set
    source_version = excluded.source_version,
    generated_at = excluded.generated_at;

  return added;
end;
$$;

create or replace function public.material_totals(p_kind text, p_query text, p_status text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  col jsonb := '{"parts":[],"built":[],"items":[],"crafted":[]}'::jsonb;
  words text[];
  result jsonb;
begin
  if coalesce(p_status, 'missing') = 'built' then
    return '[]'::jsonb;
  end if;
  if coalesce(p_kind, 'all') = 'all'
     and length(btrim(coalesce(p_query, ''))) < 2
     and coalesce(p_status, 'missing') not in ('ready', 'almost', 'owned') then
    return '[]'::jsonb;
  end if;

  select collection into col from public.profiles where user_id = auth.uid();
  if col is null then
    col := '{"parts":[],"built":[],"items":[],"crafted":[]}'::jsonb;
  end if;
  words := array_remove(regexp_split_to_array(public.fold(coalesce(p_query, '')), '\s+'), '');

  with owned as (
    select
      array(select jsonb_array_elements_text(col->'parts')) as parts,
      array(select jsonb_array_elements_text(col->'built')) as built,
      array(select jsonb_array_elements_text(col->'items')) as items
  ),
  crafted as (
    select split_part(value, '::', 1) as item_id, split_part(value, '::', 2) as part_id
    from jsonb_array_elements_text(coalesce(col->'crafted', '[]'::jsonb)) as value
    where value like '%::%'
  ),
  base as (
    select
      i.id,
      count(p.id)::int as part_count,
      count(p.id) filter (where p.id = any(o.parts))::int as owned_count,
      i.id = any(o.built) as is_built,
      i.id = any(o.items) as owned_item,
      public.fold(
        i.name || ' ' || coalesce(string_agg(p.title || ' ' || p.short || ' ' || p.english, ' '), '')
      ) as haystack
    from public.catalog_items i
    cross join owned o
    left join public.catalog_parts p on p.item_id = i.id
    where coalesce(p_kind, 'all') = 'all'
      or (p_kind = 'weapon' and i.kind in ('primary', 'secondary', 'melee'))
      or (p_kind = 'archwing' and i.kind in ('archwing', 'archgun', 'archmelee', 'necramech'))
      or i.kind = p_kind
    group by i.id, i.name, o.parts, o.built, o.items
  ),
  filtered as (
    select id
    from base
    where not is_built
      and (
        coalesce(array_length(words, 1), 0) = 0
        or not exists (
          select 1 from unnest(words) as word
          where haystack not like '%' || word || '%'
        )
      )
      and (
        coalesce(p_status, 'all') = 'all'
        or (
          p_status = 'missing'
          and not (part_count = 0 and owned_item)
        )
        or (
          p_status = 'ready'
          and part_count > 0
          and owned_count = part_count
        )
        or (
          p_status = 'almost'
          and part_count > 0
          and owned_count > 0
          and part_count - owned_count between 1 and 2
        )
        or (
          p_status = 'owned'
          and owned_count > 0
        )
      )
  ),
  lines as (
    select
      mat->>'id' as id,
      mat->>'name' as name,
      max(mat->>'image') as image,
      sum((mat->>'count')::bigint) as count
    from filtered f
    join public.catalog_parts p on p.item_id = f.id
    cross join lateral jsonb_array_elements(coalesce(p.materials, '[]'::jsonb)) as mat
    where jsonb_typeof(coalesce(p.materials, '[]'::jsonb)) = 'array'
      and (mat->>'count') ~ '^[0-9]+$'
      and coalesce(mat->>'id', '') <> ''
      and coalesce(mat->>'name', '') <> ''
      and not exists (
        select 1 from crafted c
        where c.item_id = p.item_id and c.part_id = p.id
      )
    group by mat->>'id', mat->>'name'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'name', name,
    'count', count,
    'image', image
  ) order by case when id = 'credits' then 1 else 0 end, count desc, name), '[]'::jsonb)
  into result
  from lines;

  return result;
end;
$$;
