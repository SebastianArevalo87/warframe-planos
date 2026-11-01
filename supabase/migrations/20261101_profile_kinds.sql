alter table public.catalog_items drop constraint if exists catalog_items_kind_check;
alter table public.catalog_items add constraint catalog_items_kind_check
  check (kind in ('warframe', 'primary', 'secondary', 'melee', 'archwing', 'archgun', 'archmelee', 'necramech', 'companion', 'robotic', 'amp'));

do $patch$
declare
  def text;
  old_dash text := '''archwing'', count(*) filter (where kind in (''archwing'', ''archgun'', ''archmelee'', ''necramech'') and complete),
    ''archwingTotal'', count(*) filter (where kind in (''archwing'', ''archgun'', ''archmelee'', ''necramech'')),
    ''companion'', count(*) filter (where kind = ''companion'' and complete),
    ''companionTotal'', count(*) filter (where kind = ''companion''),';
  new_dash text := '''archwing'', count(*) filter (where kind in (''archwing'', ''necramech'') and complete),
    ''archwingTotal'', count(*) filter (where kind in (''archwing'', ''necramech'')),
    ''archgun'', count(*) filter (where kind = ''archgun'' and complete),
    ''archgunTotal'', count(*) filter (where kind = ''archgun''),
    ''archmelee'', count(*) filter (where kind = ''archmelee'' and complete),
    ''archmeleeTotal'', count(*) filter (where kind = ''archmelee''),
    ''companion'', count(*) filter (where kind = ''companion'' and complete),
    ''companionTotal'', count(*) filter (where kind = ''companion''),
    ''robotic'', count(*) filter (where kind = ''robotic'' and complete),
    ''roboticTotal'', count(*) filter (where kind = ''robotic''),
    ''amp'', count(*) filter (where kind = ''amp'' and complete),
    ''ampTotal'', count(*) filter (where kind = ''amp''),';
  old_arch text := 'i.kind in (''archwing'', ''archgun'', ''archmelee'', ''necramech'')';
  new_arch text := 'i.kind in (''archwing'', ''necramech'')';
  old_kinds text := 'element->>''kind'' in (''warframe'', ''primary'', ''secondary'', ''melee'', ''archwing'', ''archgun'', ''archmelee'', ''necramech'', ''companion'')';
  new_kinds text := 'element->>''kind'' in (''warframe'', ''primary'', ''secondary'', ''melee'', ''archwing'', ''archgun'', ''archmelee'', ''necramech'', ''companion'', ''robotic'', ''amp'')';
begin
  def := pg_get_functiondef('public.dashboard_stats()'::regprocedure);
  if position(old_dash in def) = 0 then
    raise exception 'dashboard_stats no longer matches the expected text';
  end if;
  execute replace(def, old_dash, new_dash);

  def := pg_get_functiondef('public.list_items(text, text, text, integer, integer)'::regprocedure);
  execute replace(def, old_arch, new_arch);

  def := pg_get_functiondef('public.material_totals(text, text, text)'::regprocedure);
  execute replace(def, old_arch, new_arch);

  def := pg_get_functiondef('public.upsert_catalog(jsonb)'::regprocedure);
  execute replace(def, old_kinds, new_kinds);
end
$patch$;
