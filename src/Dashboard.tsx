import { useEffect, useMemo, useState } from "react";
import { fetchAdviceParts, fetchItemIndex, type DashboardHighlight, type DashboardStats, type MasteryRow } from "./lib/catalogRemote.ts";
import { formatMastery } from "./lib/mastery.ts";
import { readyToMaster, relicTargets, sharedRelics, type AdvicePart, type RelicTarget } from "./lib/relicAdvice.ts";
import { fetchWorld, type WorldNow } from "./lib/worldstate.ts";
import { KIND_LABEL, type Collection, type KindFilter, type StatusFilter } from "./types.ts";

export function Dashboard({
  stats,
  accountName,
  collection,
  onOpen,
  onSearch,
  onSell,
  onMastered,
}: {
  stats: DashboardStats | null;
  accountName: string;
  collection: Collection;
  onOpen: (id: string) => void;
  onSearch: (kind: KindFilter, status: StatusFilter) => void;
  onSell: () => void;
  onMastered: () => void;
}) {
  const [world, setWorld] = useState<WorldNow | null>(null);
  const [worldError, setWorldError] = useState("");
  const [parts, setParts] = useState<AdvicePart[] | null>(null);
  const [gear, setGear] = useState<MasteryRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetchWorld()
        .then((next) => {
          if (!cancelled) {
            setWorld(next);
            setWorldError("");
          }
        })
        .catch(() => {
          if (!cancelled) setWorldError("No pude leer el tiempo del sistema.");
        });
    };
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchAdviceParts(), fetchItemIndex()])
      .then(([nextParts, nextGear]) => {
        if (cancelled) return;
        setParts(nextParts);
        setGear(nextGear);
      })
      .catch(() => {
        if (!cancelled) {
          setParts([]);
          setGear([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const targets = useMemo(() => (parts ? relicTargets(parts, collection) : []), [collection, parts]);
  const shared = useMemo(() => sharedRelics(targets), [targets]);
  const pending = useMemo(() => (gear ? readyToMaster(gear, collection) : []), [collection, gear]);
  const known = useMemo(() => {
    const byName = new Map<string, { id: string; mastered: boolean }>();
    const mastered = new Set(collection.mastered);
    for (const item of gear ?? []) byName.set(item.name.toLowerCase(), { id: item.id, mastered: mastered.has(item.id) });
    return byName;
  }, [collection.mastered, gear]);

  if (!stats) return <p className="text-mute">Abriendo el tablero…</p>;

  const framePercent = percent(stats.frames, stats.frameTotal);
  const weaponPercent = percent(stats.weapons, stats.weaponTotal);

  return (
    <div className="flex flex-col gap-8">
      {accountName && <p className="text-sm text-mute">{accountName}</p>}
      <WorldPanel world={world} error={worldError} known={known} onOpen={onOpen} />
      <MasteryHelp
        targets={targets}
        shared={shared}
        pending={pending}
        partsReady={parts !== null}
        onOpen={onOpen}
        onMastered={onMastered}
      />
      <section>
        <h2 className="text-lg font-medium text-bone">Tu equipo</h2>
        <p className="mt-1 text-sm text-mute">Lo que ya construiste, por categoría.</p>
    <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 lg:grid-cols-6 lg:gap-4">

      <div className="order-2 h-full lg:col-span-2">
        <BigNumber
          label="Warframes"
          value={stats.frames}
          total={stats.frameTotal}
          percent={framePercent}
          onClick={() => onSearch("warframe", "built")}
        />
      </div>
      <div className="order-3 h-full lg:col-span-2">
        <BigNumber
          label="Armas"
          value={stats.weapons}
          total={stats.weaponTotal}
          percent={weaponPercent}
          onClick={() => onSearch("weapon", "built")}
        />
      </div>
      <div className="order-6 col-span-2 h-full lg:order-4 lg:col-span-2">
        <SellCard copies={stats.sellCopies} items={stats.sellItemCount} onClick={onSell} />
      </div>

      <section className="order-4 col-span-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:order-5 lg:col-span-6 lg:grid-cols-5">
        <SmallMeter label="Primarias" value={stats.primary} total={stats.primaryTotal} onClick={() => onSearch("primary", "built")} />
        <SmallMeter
          label="Secundarias"
          value={stats.secondary}
          total={stats.secondaryTotal}
          onClick={() => onSearch("secondary", "built")}
        />
        <SmallMeter label="Cuerpo a cuerpo" value={stats.melee} total={stats.meleeTotal} onClick={() => onSearch("melee", "built")} />
        <SmallMeter label="Archwing" value={stats.archwing} total={stats.archwingTotal} onClick={() => onSearch("archwing", "built")} />
        <SmallMeter label="Archcañón" value={stats.archgun} total={stats.archgunTotal} onClick={() => onSearch("archgun", "built")} />
        <SmallMeter label="Archmelee" value={stats.archmelee} total={stats.archmeleeTotal} onClick={() => onSearch("archmelee", "built")} />
        <SmallMeter
          label="Compañero"
          value={stats.companion}
          total={stats.companionTotal}
          onClick={() => onSearch("companion", "built")}
        />
        <SmallMeter label="Robótico" value={stats.robotic} total={stats.roboticTotal} onClick={() => onSearch("robotic", "built")} />
        <SmallMeter label="Amps" value={stats.amp} total={stats.ampTotal} onClick={() => onSearch("amp", "built")} />
      </section>

      <section className="order-5 col-span-2 grid grid-cols-3 gap-2 lg:order-6 lg:col-span-6 xl:col-span-3">
        <CountCard label="Planos tuyos" value={stats.ownedParts} hint={`de ${stats.partTotal}`} onClick={() => onSearch("all", "owned")} />
        <CountCard label="Listos" value={stats.ready} hint="para fundir" onClick={() => onSearch("all", "ready")} />
        <CountCard label="Casi" value={stats.almost} hint="faltan 1 o 2" onClick={() => onSearch("all", "almost")} />
      </section>

      <div className="order-7 col-span-2 flex flex-col gap-6 lg:col-span-6 lg:grid lg:grid-cols-2 lg:gap-8">
        <HighlightList
          title="Listos para fundir"
          empty="Cuando tengas todos los planos de un ítem, aparece aquí."
          items={stats.readyItems}
          total={stats.ready}
          onOpen={onOpen}
          onSeeAll={stats.ready > stats.readyItems.length ? () => onSearch("all", "ready") : undefined}
        />
        <HighlightList
          title="Les falta poco"
          empty="Todavía no hay ítems a uno o dos planos de estar listos."
          items={stats.almostItems}
          total={stats.almost}
          onOpen={onOpen}
          onSeeAll={stats.almost > stats.almostItems.length ? () => onSearch("all", "almost") : undefined}
        />
      </div>
      </div>
      </section>
    </div>
  );
}

function percent(value: number, total: number) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

function BigNumber({
  label,
  value,
  total,
  percent: share,
  onClick,
}: {
  label: string;
  value: number;
  total: number;
  percent: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value} de ${total} construidos. Ver la búsqueda.`}
      className="h-full w-full rounded-2xl border border-line bg-panel px-4 py-4 text-left hover:border-gold"
    >
      <p className="text-[11px] font-medium tracking-[0.16em] text-gold uppercase">{label}</p>
      <p className="mt-2 text-4xl font-medium text-bone">
        {value}
        <span className="text-lg text-mute">/{total}</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-gold" style={{ width: `${share}%` }} />
      </div>
      <p className="mt-2 text-xs text-mute">{share}% construido</p>
    </button>
  );
}

function SmallMeter({ label, value, total, onClick }: { label: string; value: number; total: number; onClick: () => void }) {
  const share = percent(value, total);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value} de ${total} construidas. Ver la búsqueda.`}
      className="rounded-2xl border border-line bg-panel/80 px-3 py-3 text-left hover:border-gold"
    >
      <p className="text-[11px] text-mute">{label}</p>
      <p className="mt-1 text-lg text-bone">
        {value}
        <span className="text-sm text-mute">/{total}</span>
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-moss" style={{ width: `${share}%` }} />
      </div>
    </button>
  );
}

function CountCard({ label, value, hint, onClick }: { label: string; value: number; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value}. ${hint}. Ver la búsqueda.`}
      className="h-full rounded-2xl border border-line bg-ink px-3 py-3 text-left hover:border-gold"
    >
      <p className="text-[11px] text-mute">{label}</p>
      <p className="mt-1 text-2xl font-medium text-bone">{value}</p>
      <p className="text-[11px] text-mute">{hint}</p>
    </button>
  );
}

function SellCard({ copies, items, onClick }: { copies: number; items: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Para vender: ${items} ítems, ${copies} copias. Abrir la página.`}
      className="h-full w-full rounded-2xl border border-line bg-panel px-4 py-4 text-left hover:border-gold"
    >
      <p className="text-[11px] font-medium tracking-[0.16em] text-gold uppercase">Para vender</p>
      <p className="mt-2 text-4xl font-medium text-bone">{copies}</p>
      <p className="mt-1 text-sm text-mute">
        {items === 1 ? "1 ítem" : `${items} ítems`} · {copies === 1 ? "1 copia" : `${copies} copias`}
      </p>
    </button>
  );
}

function HighlightList({
  title,
  empty,
  items,
  total,
  onOpen,
  onSeeAll,
}: {
  title: string;
  empty: string;
  items: DashboardHighlight[];
  total: number;
  onOpen: (id: string) => void;
  onSeeAll?: () => void;
}) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-medium text-bone">{title}</h2>
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

function WorldPanel({
  world,
  error,
  known,
  onOpen,
}: {
  world: WorldNow | null;
  error: string;
  known: Map<string, { id: string; mastered: boolean }>;
  onOpen: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="text-lg font-medium text-bone">Ahora</h2>
      <p className="mt-1 text-sm text-mute">Alertas, eventos y los ciclos que cambian solos.</p>
      {error && <p className="mt-3 text-sm text-clay">{error}</p>}
      {!world && !error && <p className="mt-3 text-sm text-mute">Leyendo el sistema…</p>}
      {world && (
        <div className="mt-4 flex flex-col gap-4">
          <ul className="flex flex-wrap gap-2">
            {world.cycles.map((entry) => (
              <li key={entry.label} className="min-w-28 rounded-2xl border border-line bg-panel px-3 py-2">
                <p className="text-[11px] tracking-[0.14em] text-mute uppercase">{entry.label}</p>
                <p className="text-sm text-bone">{entry.state}</p>
                <p className="text-[11px] text-gold">{entry.timeLeft}</p>
              </li>
            ))}
          </ul>
          <div className="grid gap-3 lg:grid-cols-2">
            <ChoiceList title="Circuito" hint="Warframes de esta semana" names={world.circuit} known={known} onOpen={onOpen} />
            <ChoiceList title="Incarnon" hint="Adaptadores del Circuito de acero" names={world.incarnon} known={known} onOpen={onOpen} />
          </div>
          <NoticeList title="Alertas" empty="No hay alertas activas." notices={world.alerts} extra={world.hiddenAlerts} />
          <NoticeList title="Eventos" empty="No hay eventos activos." notices={world.events} extra={0} />
        </div>
      )}
    </section>
  );
}

function ChoiceList({
  title,
  hint,
  names,
  known,
  onOpen,
}: {
  title: string;
  hint: string;
  names: string[];
  known: Map<string, { id: string; mastered: boolean }>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-3 py-3">
      <p className="text-[11px] font-medium tracking-[0.16em] text-gold uppercase">{title}</p>
      <p className="mt-1 text-xs text-mute">{hint}</p>
      {names.length === 0 ? (
        <p className="mt-2 text-sm text-mute">Sin datos esta semana.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {names.map((name) => {
            const match = known.get(name.toLowerCase());
            const className = match?.mastered
              ? "rounded-full border border-moss/40 px-2.5 py-1 text-sm text-moss"
              : "rounded-full border border-line px-2.5 py-1 text-sm text-bone hover:border-gold";
            const note = match ? (match.mastered ? "dominado" : "sin dominar") : "";
            if (!match) return <li key={name} className={className}>{name}</li>;
            return (
              <li key={name}>
                <button type="button" onClick={() => onOpen(match.id)} className={className} aria-label={`${name}, ${note}`}>
                  {name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NoticeList({ title, empty, notices, extra }: { title: string; empty: string; notices: WorldNow["alerts"]; extra: number }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-bone">{title}</h3>
      {notices.length === 0 ? (
        <p className="mt-1 text-sm text-mute">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {notices.map((notice) => (
            <li key={notice.id} className="rounded-2xl border border-line bg-ink px-3 py-2">
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-bone">{notice.title}</span>
                <span className="shrink-0 text-xs text-gold">{notice.timeLeft}</span>
              </span>
              {notice.detail && <span className="mt-0.5 block text-xs text-mute">{notice.detail}</span>}
            </li>
          ))}
          {extra > 0 && <li className="text-xs text-mute">{extra === 1 ? "Y 1 alerta más." : `Y ${extra} alertas más.`}</li>}
        </ul>
      )}
    </div>
  );
}

function MasteryHelp({
  targets,
  shared,
  pending,
  partsReady,
  onOpen,
  onMastered,
}: {
  targets: RelicTarget[];
  shared: Array<{ name: string; count: number }>;
  pending: Array<MasteryRow & { xp: number }>;
  partsReady: boolean;
  onOpen: (id: string) => void;
  onMastered: () => void;
}) {
  const shown = pending.slice(0, 4);
  return (
    <section>
      <h2 className="text-lg font-medium text-bone">Para subir</h2>
      <p className="mt-1 text-sm text-mute">Reliquias de lo que te falta poco, y lo que ya puedes llevar a 30.</p>
      {!partsReady && <p className="mt-3 text-sm text-mute">Buscando reliquias…</p>}
      {partsReady && targets.length === 0 && (
        <p className="mt-3 text-sm text-mute">
          Marca en Cargar los planos que ya tienes. Si a un objeto sin dominar le faltan uno o dos, aquí sale la reliquia.
        </p>
      )}
      {shared.length > 0 && (
        <p className="mt-3 text-sm text-bone">
          {shared.map((relic) => `${relic.name} sirve para ${relic.count} piezas`).join(" · ")}
        </p>
      )}
      {targets.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {targets.map((target) => (
            <li key={target.itemId}>
              <button
                type="button"
                onClick={() => onOpen(target.itemId)}
                className="w-full rounded-2xl border border-line bg-panel px-3 py-2 text-left hover:border-gold"
              >
                <span className="flex items-center gap-3">
                  {target.image && <img src={target.image} alt="" className="h-12 w-12 shrink-0 rounded-xl bg-ink object-contain" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-bone">{target.name}</span>
                    <span className="text-xs text-mute">
                      {KIND_LABEL[target.kind]} · {target.missingCount === 1 ? "falta 1 plano" : "faltan 2 planos"} · {formatMastery(target.xp)} al dominarlo
                    </span>
                  </span>
                </span>
                <span className="mt-2 flex flex-col gap-1">
                  {target.missing.map((part) => (
                    <span key={part.part} className="text-xs text-mute">
                      <span className="text-bone">{part.part}</span>
                      {part.relics.length === 0
                        ? " · no sale en reliquias"
                        : part.relics.map((relic) => ` · ${relic.name} (${relic.label}${relic.vaulted ? ", bóveda" : ""})`).join("")}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {shown.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
            <h3 className="text-sm font-medium text-bone">Ya construidos, sin dominar</h3>
            {pending.length > shown.length && (
              <button type="button" onClick={onMastered} className="text-sm text-gold">
                Ver los {pending.length}
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-2">
            {shown.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-ink px-3 py-2 text-left hover:border-gold"
                >
                  {item.image && <img src={item.image} alt="" className="h-10 w-10 shrink-0 rounded-xl bg-panel object-contain" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-bone">{item.name}</span>
                    <span className="text-xs text-mute">{KIND_LABEL[item.kind]} · {formatMastery(item.xp)} al rango 30</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
