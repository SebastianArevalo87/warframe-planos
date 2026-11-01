import type { CatalogItem, PartRelic, RelicRarity } from "./types.ts";
import { Sheet } from "./Sheet.tsx";

const RARITY_LABEL: Record<RelicRarity, string> = {
  common: "Común",
  uncommon: "Poco común",
  rare: "Raro",
};

const RARITY_CLASS: Record<RelicRarity, string> = {
  common: "text-mute",
  uncommon: "text-bone",
  rare: "text-gold",
};

export function RelicModal({ item, onClose }: { item: CatalogItem; onClose: () => void }) {
  const listed = item.parts.filter((part) => part.relics.length > 0);
  return (
    <Sheet label={`Reliquias de ${item.name}`} onClose={onClose} stacked>
      <h2 className="text-lg font-medium text-bone">Reliquias de {item.name}</h2>
      <p className="mt-1 text-sm text-mute">En qué reliquia sale cada pieza y si ahí es común, poco común o raro.</p>
      {listed.length === 0 ? (
        <p className="mt-4 text-sm text-mute">Ninguna pieza de este plano sale en reliquias.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {listed.map((part) => (
            <section key={part.id} className="min-w-0">
              <h3 className="text-sm font-medium text-bone">{part.title}</h3>
              <RelicGroup title="Disponibles" relics={part.relics.filter((relic) => !relic.vaulted)} />
              <RelicGroup title="En la bóveda" relics={part.relics.filter((relic) => relic.vaulted)} />
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function RelicGroup({ title, relics }: { title: string; relics: PartRelic[] }) {
  if (relics.length === 0) return null;
  return (
    <div className="mt-2 min-w-0">
      <p className="text-[11px] font-medium tracking-[0.16em] text-mute uppercase">{title}</p>
      <ul className="mt-1 grid gap-1">
        {relics.map((relic) => (
          <li key={relic.name} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-ink/60 px-2 py-1.5">
            <span className="min-w-0 text-sm text-bone">{relic.name}</span>
            <span className={`shrink-0 text-sm ${RARITY_CLASS[relic.rarity]}`}>{RARITY_LABEL[relic.rarity]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
