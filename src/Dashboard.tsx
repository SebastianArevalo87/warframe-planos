import type { DashboardHighlight, DashboardStats } from "./lib/catalogRemote.ts";

const KIND_LABEL = {
  warframe: "Warframe",
  primary: "Primaria",
  secondary: "Secundaria",
  melee: "Melee",
} as const;

export function Dashboard({
  stats,
  accountName,
  mastery,
  onOpen,
  onSearchReady,
}: {
  stats: DashboardStats | null;
  accountName: string;
  mastery: string;
  onOpen: (id: string) => void;
  onSearchReady: () => void;
}) {
  if (!stats) return <p className="text-mute">Abriendo el tablero…</p>;

  const framePercent = percent(stats.frames, stats.frameTotal);
  const weaponPercent = percent(stats.weapons, stats.weaponTotal);

  return (
    <div className="flex flex-col gap-6">
      {(accountName || mastery) && (
        <p className="text-sm text-mute">
          {accountName || "Sin cuenta de Warframe"}
          {mastery ? ` · maestría ${mastery}` : ""}
        </p>
      )}

      <section className="grid grid-cols-2 gap-3">
        <BigNumber label="Warframes" value={stats.frames} total={stats.frameTotal} percent={framePercent} />
        <BigNumber label="Armas" value={stats.weapons} total={stats.weaponTotal} percent={weaponPercent} />
      </section>

      <section className="grid grid-cols-3 gap-2">
        <SmallMeter label="Primarias" value={stats.primary} total={stats.primaryTotal} />
        <SmallMeter label="Secundarias" value={stats.secondary} total={stats.secondaryTotal} />
        <SmallMeter label="Melee" value={stats.melee} total={stats.meleeTotal} />
      </section>

      <section className="grid grid-cols-3 gap-2">
        <CountCard label="Planos tuyos" value={stats.ownedParts} hint={`de ${stats.partTotal}`} />
        <CountCard label="Listos" value={stats.ready} hint="para fundir" />
        <CountCard label="Casi" value={stats.almost} hint="faltan 1 o 2" />
      </section>

      <HighlightList
        title="Para vender"
        empty="Aquí salen los planos vendibles de ítems que ya construiste, y los ítems sin planos que sí tienes."
        items={stats.sellItems}
        total={stats.sellCopies}
        stock
        onOpen={onOpen}
      />
      <HighlightList
        title="Listos para fundir"
        empty="Cuando tengas todos los planos de un ítem, aparece aquí."
        items={stats.readyItems}
        total={stats.ready}
        onOpen={onOpen}
        onSeeAll={stats.ready > stats.readyItems.length ? onSearchReady : undefined}
      />
      <HighlightList
        title="Les falta poco"
        empty="Todavía no hay ítems a uno o dos planos de estar listos."
        items={stats.almostItems}
        total={stats.almost}
        onOpen={onOpen}
      />
    </div>
  );
}

function percent(value: number, total: number) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

function BigNumber({ label, value, total, percent: share }: { label: string; value: number; total: number; percent: number }) {
  return (
    <article className="rounded-2xl border border-line bg-panel px-4 py-4">
      <p className="text-[11px] font-medium tracking-[0.16em] text-gold uppercase">{label}</p>
      <p className="mt-2 text-4xl font-medium text-bone">
        {value}
        <span className="text-lg text-mute">/{total}</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-gold" style={{ width: `${share}%` }} />
      </div>
      <p className="mt-2 text-xs text-mute">{share}% construido</p>
    </article>
  );
}

function SmallMeter({ label, value, total }: { label: string; value: number; total: number }) {
  const share = percent(value, total);
  return (
    <article className="rounded-2xl border border-line bg-panel/80 px-3 py-3">
      <p className="text-[11px] text-mute">{label}</p>
      <p className="mt-1 text-lg text-bone">
        {value}
        <span className="text-sm text-mute">/{total}</span>
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-moss" style={{ width: `${share}%` }} />
      </div>
    </article>
  );
}

function CountCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <article className="rounded-2xl border border-line bg-ink px-3 py-3">
      <p className="text-[11px] text-mute">{label}</p>
      <p className="mt-1 text-2xl font-medium text-bone">{value}</p>
      <p className="text-[11px] text-mute">{hint}</p>
    </article>
  );
}

function HighlightList({
  title,
  empty,
  items,
  total,
  onOpen,
  onSeeAll,
  stock = false,
}: {
  title: string;
  empty: string;
  items: DashboardHighlight[];
  total: number;
  onOpen: (id: string) => void;
  onSeeAll?: () => void;
  stock?: boolean;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium text-bone">{title}</h2>
        {stock && total > 0 && <span className="text-sm text-mute">{total} {total === 1 ? "copia" : "copias"}</span>}
        {onSeeAll && (
          <button type="button" onClick={onSeeAll} className="text-sm text-gold">
            Ver los {total}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-mute">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-panel px-3 py-2 text-left hover:border-gold"
              >
                {item.image && (
                  <img src={item.image} alt="" className="h-12 w-12 shrink-0 rounded-xl bg-ink object-contain" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-bone">{item.name}</span>
                  <span className="text-xs text-mute">
                    {KIND_LABEL[item.kind]}
                    {item.caption
                      ? ` · ${item.caption}`
                      : item.missing === 0
                        ? " · listo para fundir"
                        : item.missing === 1
                          ? " · falta 1 plano"
                          : ` · faltan ${item.missing} planos`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
