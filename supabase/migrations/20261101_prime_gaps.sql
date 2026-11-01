update public.catalog_parts as p
set
  relics = gap.relics,
  materials = case when jsonb_array_length(p.materials) = 0 then gap.materials else p.materials end
from (
  values
    (
      '/Lotus/Types/Recipes/WarframeRecipes/CitrinePrimeBlueprint',
      '[{"name":"Meso C11","rarity":"rare","vaulted":false}]'::jsonb,
      '[{"id":"/Lotus/Types/Items/MiscItems/OrokinCell","name":"Célula orokin","count":5,"image":"https://cdn.warframestat.us/img/ComponentCell.png"},{"id":"credits","name":"Créditos","count":25000,"image":"https://cdn.warframestat.us/img/CollectCredits.png"}]'::jsonb
    ),
    (
      '/Lotus/Types/Recipes/WarframeRecipes/CitrinePrimeChassisComponent',
      '[{"name":"Neo C11","rarity":"common","vaulted":false}]'::jsonb,
      '[{"id":"/Lotus/Types/Items/MiscItems/Alertium","name":"Extracto de nitain","count":2,"image":"https://cdn.warframestat.us/img/Alertium.png"},{"id":"/Lotus/Types/Items/MiscItems/ControlModule","name":"Módulo de control","count":10,"image":"https://cdn.warframestat.us/img/ControlModule.png"},{"id":"/Lotus/Types/Items/MiscItems/Rubedo","name":"Rubedo","count":1600,"image":"https://cdn.warframestat.us/img/ComponentRubedo.png"},{"id":"/Lotus/Types/Items/MiscItems/Salvage","name":"Chatarra","count":7800,"image":"https://cdn.warframestat.us/img/ComponentSalvage.png"},{"id":"credits","name":"Créditos","count":15000,"image":"https://cdn.warframestat.us/img/CollectCredits.png"}]'::jsonb
    ),
    (
      '/Lotus/Types/Recipes/WarframeRecipes/CitrinePrimeHelmetComponent',
      '[{"name":"Axi C12","rarity":"rare","vaulted":false}]'::jsonb,
      '[{"id":"/Lotus/Types/Items/MiscItems/Neurode","name":"Neurodos","count":4,"image":"https://cdn.warframestat.us/img/ComponentNeurode.png"},{"id":"/Lotus/Types/Items/MiscItems/Circuits","name":"Circuitos","count":1750,"image":"https://cdn.warframestat.us/img/ComponentCircuits.png"},{"id":"/Lotus/Types/Items/MiscItems/Plastids","name":"Plástidos","count":450,"image":"https://cdn.warframestat.us/img/ComponentPlastids.png"},{"id":"/Lotus/Types/Items/MiscItems/Nanospores","name":"Nanoesporas","count":4750,"image":"https://cdn.warframestat.us/img/ComponentNanospores.png"},{"id":"credits","name":"Créditos","count":15000,"image":"https://cdn.warframestat.us/img/CollectCredits.png"}]'::jsonb
    ),
    (
      '/Lotus/Types/Recipes/WarframeRecipes/CitrinePrimeSystemsComponent',
      '[{"name":"Lith S19","rarity":"uncommon","vaulted":false}]'::jsonb,
      '[{"id":"/Lotus/Types/Items/MiscItems/ArgonCrystal","name":"Cristal de argón","count":2,"image":"https://cdn.warframestat.us/img/ArgonCrystal.png"},{"id":"/Lotus/Types/Items/MiscItems/NeuralSensor","name":"Sensores neuronales","count":5,"image":"https://cdn.warframestat.us/img/NeuralSensor.png"},{"id":"/Lotus/Types/Items/MiscItems/PolymerBundle","name":"Paquete de polímero","count":1775,"image":"https://cdn.warframestat.us/img/PolymerBundle.png"},{"id":"/Lotus/Types/Items/MiscItems/Ferrite","name":"Ferrita","count":4000,"image":"https://cdn.warframestat.us/img/ComponentFerrite.png"},{"id":"credits","name":"Créditos","count":15000,"image":"https://cdn.warframestat.us/img/CollectCredits.png"}]'::jsonb
    ),
    (
      '/Lotus/Types/Recipes/Weapons/CorufellPrimeBlueprint',
      '[{"name":"Meso V17","rarity":"common","vaulted":false}]'::jsonb,
      '[{"id":"/Lotus/Types/Items/MiscItems/OrokinCell","name":"Célula orokin","count":15,"image":"https://cdn.warframestat.us/img/ComponentCell.png"},{"id":"credits","name":"Créditos","count":15000,"image":"https://cdn.warframestat.us/img/CollectCredits.png"}]'::jsonb
    ),
    (
      '/Lotus/Types/Recipes/Weapons/WeaponParts/CorufellPrimeHandle',
      '[{"name":"Axi C12","rarity":"uncommon","vaulted":false}]'::jsonb,
      '[]'::jsonb
    ),
    (
      '/Lotus/Types/Recipes/Weapons/WeaponParts/CorufellPrimeReceiver',
      '[{"name":"Neo C10","rarity":"rare","vaulted":false}]'::jsonb,
      '[]'::jsonb
    ),
    (
      '/Lotus/Types/Recipes/Weapons/WeaponParts/CorufellPrimeBarrel',
      '[{"name":"Lith C15","rarity":"common","vaulted":false}]'::jsonb,
      '[]'::jsonb
    ),
    (
      '/Lotus/Types/Recipes/Weapons/SteflosPrimeBlueprint',
      '[{"name":"Neo Y2","rarity":"uncommon","vaulted":false}]'::jsonb,
      '[{"id":"/Lotus/Types/Items/MiscItems/OrokinCell","name":"Célula orokin","count":10,"image":"https://cdn.warframestat.us/img/ComponentCell.png"},{"id":"credits","name":"Créditos","count":15000,"image":"https://cdn.warframestat.us/img/CollectCredits.png"}]'::jsonb
    ),
    (
      '/Lotus/Types/Recipes/Weapons/WeaponParts/SteflosPrimeBarrel',
      '[{"name":"Axi S21","rarity":"rare","vaulted":false}]'::jsonb,
      '[]'::jsonb
    ),
    (
      '/Lotus/Types/Recipes/Weapons/WeaponParts/SteflosPrimeReceiver',
      '[{"name":"Lith A13","rarity":"common","vaulted":false}]'::jsonb,
      '[]'::jsonb
    ),
    (
      '/Lotus/Types/Recipes/Weapons/WeaponParts/SteflosPrimeStock',
      '[{"name":"Meso D9","rarity":"uncommon","vaulted":false}]'::jsonb,
      '[]'::jsonb
    )
) as gap(id, relics, materials)
where p.id = gap.id
  and jsonb_array_length(p.relics) = 0;
