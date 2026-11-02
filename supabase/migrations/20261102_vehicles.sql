alter table public.catalog_items drop constraint if exists catalog_items_kind_check;
alter table public.catalog_items add constraint catalog_items_kind_check
  check (kind in ('warframe', 'primary', 'secondary', 'melee', 'archwing', 'archgun', 'archmelee', 'necramech', 'companion', 'robotic', 'amp', 'vehicle'));

do $patch$
declare
  def text;
  old_kinds text := 'element->>''kind'' in (''warframe'', ''primary'', ''secondary'', ''melee'', ''archwing'', ''archgun'', ''archmelee'', ''necramech'', ''companion'', ''robotic'', ''amp'')';
  new_kinds text := 'element->>''kind'' in (''warframe'', ''primary'', ''secondary'', ''melee'', ''archwing'', ''archgun'', ''archmelee'', ''necramech'', ''companion'', ''robotic'', ''amp'', ''vehicle'')';
begin
  def := pg_get_functiondef('public.upsert_catalog(jsonb)'::regprocedure);
  if position(old_kinds in def) = 0 then
    raise exception 'upsert_catalog no longer has the expected kind list';
  end if;
  execute replace(def, old_kinds, new_kinds);
end
$patch$;

insert into public.catalog_items (id, name, kind, vaulted, image, tradable)
values
  ('/Lotus/Types/Vehicles/Hoverboard/HoverboardParts/PartComponents/HoverboardSolarisA/HoverboardSolarisADeck', 'Bad Baby', 'vehicle', false, 'https://cdn.warframestat.us/img/HoverboardSolarisADeck.png', false),
  ('/Lotus/Types/Vehicles/Hoverboard/HoverboardParts/PartComponents/HoverboardInfestedB/HoverboardInfestedBDeck', 'Feverspine', 'vehicle', false, 'https://cdn.warframestat.us/img/HoverboardInfestedBDeck.png', false),
  ('/Lotus/Types/Vehicles/Hoverboard/HoverboardParts/PartComponents/HoverboardCorpusA/HoverboardCorpusADeck', 'Flatbelly', 'vehicle', false, 'https://cdn.warframestat.us/img/HoverboardCorpusADeck.png', false),
  ('/Lotus/Types/Vehicles/Hoverboard/HoverboardParts/PartComponents/HoverboardCorpusB/HoverboardCorpusBDeck', 'Needlenose', 'vehicle', false, 'https://cdn.warframestat.us/img/HoverboardCorpusBDeck.png', false),
  ('/Lotus/Types/Vehicles/Hoverboard/HoverboardParts/PartComponents/HoverboardCorpusC/HoverboardCorpusCDeck', 'Runway', 'vehicle', false, 'https://cdn.warframestat.us/img/HoverboardCorpusCDeck.png', false),
  ('/Lotus/Types/Game/CrewShip/Plexus/Plexus', 'Plexus', 'vehicle', false, 'https://wiki.warframe.com/images/Plexus.png', false)
on conflict (id) do update set
  name = excluded.name,
  kind = excluded.kind,
  image = excluded.image,
  updated_at = now();
