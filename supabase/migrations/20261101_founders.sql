create or replace function public.is_founder(item_id text)
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $$
  select item_id in (
    '/Lotus/Powersuits/Excalibur/ExcaliburPrime',
    '/Lotus/Weapons/Tenno/Pistol/LatoPrime',
    '/Lotus/Weapons/Tenno/Melee/LongSword/SkanaPrime'
  );
$$;

revoke all on function public.is_founder(text) from public, anon;
grant execute on function public.is_founder(text) to authenticated;

do $patch$
declare
  def text;
  old_from text := $q$from public.catalog_items i
    left join public.catalog_parts p on p.item_id = i.id
    group by i.id$q$;
  new_from text := $q$from public.catalog_items i
    left join public.catalog_parts p on p.item_id = i.id
    where p_include_founders or not public.is_founder(i.id)
    group by i.id$q$;
  old_where text := $q$where coalesce(p_kind, 'all') = 'all'$q$;
  new_where text := $q$where (p_include_founders or not public.is_founder(i.id))
      and (coalesce(p_kind, 'all') = 'all'$q$;
  old_group text := $q$or i.kind = p_kind
    group by i.id, o.parts, o.built, o.items$q$;
  new_group text := $q$or i.kind = p_kind
      )
    group by i.id, o.parts, o.built, o.items$q$;
  dash_sig text := 'CREATE OR REPLACE FUNCTION public.dashboard_stats()';
  list_sig text := 'CREATE OR REPLACE FUNCTION public.list_items(p_kind text, p_query text, p_status text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)';
begin
  def := pg_get_functiondef('public.dashboard_stats()'::regprocedure);
  if position(dash_sig in def) = 0 or position(old_from in def) = 0 then
    raise exception 'dashboard_stats no longer matches the expected text';
  end if;
  def := replace(def, dash_sig, 'CREATE OR REPLACE FUNCTION public.dashboard_stats(p_include_founders boolean DEFAULT false)');
  def := replace(def, old_from, new_from);
  execute 'drop function public.dashboard_stats()';
  execute def;
  execute 'revoke all on function public.dashboard_stats(boolean) from public, anon';
  execute 'grant execute on function public.dashboard_stats(boolean) to authenticated';

  def := pg_get_functiondef('public.list_items(text, text, text, integer, integer)'::regprocedure);
  if position(list_sig in def) = 0 or position(old_where in def) = 0 or position(old_group in def) = 0 then
    raise exception 'list_items no longer matches the expected text';
  end if;
  def := replace(
    def,
    list_sig,
    'CREATE OR REPLACE FUNCTION public.list_items(p_kind text, p_query text, p_status text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0, p_include_founders boolean DEFAULT false)'
  );
  def := replace(def, old_where, new_where);
  def := replace(def, old_group, new_group);
  execute 'drop function public.list_items(text, text, text, integer, integer)';
  execute def;
  execute 'revoke all on function public.list_items(text, text, text, integer, integer, boolean) from public, anon';
  execute 'grant execute on function public.list_items(text, text, text, integer, integer, boolean) to authenticated';
end
$patch$;

notify pgrst, 'reload schema';
