alter table public.catalog_items drop constraint if exists catalog_items_kind_check;
alter table public.catalog_items add constraint catalog_items_kind_check
  check (kind in ('warframe', 'primary', 'secondary', 'melee', 'archwing', 'archgun', 'archmelee', 'necramech', 'companion'));

update public.catalog_items
set kind = 'necramech'
where kind = 'warframe'
  and name in ('Voidrig', 'Bonewidow');

do $patch$
declare
  def text;
  old_arch text := 'kind in (''archwing'', ''archgun'', ''archmelee'')';
  new_arch text := 'kind in (''archwing'', ''archgun'', ''archmelee'', ''necramech'')';
  old_kinds text := 'element->>''kind'' in (''warframe'', ''primary'', ''secondary'', ''melee'', ''archwing'', ''archgun'', ''archmelee'', ''companion'')';
  new_kinds text := 'element->>''kind'' in (''warframe'', ''primary'', ''secondary'', ''melee'', ''archwing'', ''archgun'', ''archmelee'', ''necramech'', ''companion'')';
begin
  def := pg_get_functiondef('public.dashboard_stats()'::regprocedure);
  def := replace(def, old_arch, new_arch);
  execute def;

  def := pg_get_functiondef('public.list_items(text, text, text, integer, integer)'::regprocedure);
  def := replace(def, old_arch, new_arch);
  execute def;

  def := pg_get_functiondef('public.material_totals(text, text, text)'::regprocedure);
  def := replace(def, old_arch, new_arch);
  execute def;

  def := pg_get_functiondef('public.upsert_catalog(jsonb)'::regprocedure);
  def := replace(def, old_kinds, new_kinds);
  execute def;
end
$patch$;
