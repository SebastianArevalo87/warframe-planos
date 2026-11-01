import { useEffect, useMemo, useState } from "react";
import { fetchAdviceParts, fetchItemIndex, type DashboardHighlight, type DashboardStats, type MasteryRow } from "./lib/catalogRemote.ts";
import { formatMastery } from "./lib/mastery.ts";
import { readyToMaster, relicTargets, sharedRelics, type AdvicePart, type RelicTarget } from "./lib/relicAdvice.ts";
import { fetchCodaShop, codaElement, type CodaShop } from "./lib/coda.ts";
import { fetchWorld, formatTimeLeft, type WorldNow } from "./lib/worldstate.ts";
import { useNames } from "./Locale.tsx";
import { useShowFounders } from "./lib/founders.ts";
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
  const foundersVisible = useShowFounders();
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
  }, [foundersVisible]);

  const targets = useMemo(() => (parts ? relicTargets(parts, collection) : []), [collection, parts]);
  const shared = useMemo(() => sharedRelics(targets), [targets]);
  const pending = useMemo(() => (gear ? readyToMaster(gear, collection) : []), [collection, gear]);
  const known = useMemo(() => {
    const byName = new Map<string, { id: string; mastered: boolean }>();
    const mastered = new Set(collection.mastered);
    for (const item of gear ?? []) byName.set(item.name.toLowerCase(), { id: item.id, mastered: mastered.has(item.id) });
    return byName;
  }, [collection.mastered, gear]);

  if (!stats) return <p className="text-mute">Abriendo el farmeo…</p>;

  const framePercent = percent(stats.frames, stats.frameTotal);
  const weaponPercent = percent(stats.weapons, stats.weaponTotal);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-xl font-medium text-bone">Farmeo</h2>
        <p className="mt-1 text-sm text-mute">Lo marcas a mano. Aquí está lo que te acerca a la siguiente maestría.</p>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <MasteryHelp targets={targets} shared={shared} partsReady={parts !== null} onOpen={onOpen} />
          </div>
          <div className="flex flex-col gap-6 lg:col-span-5">
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
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <LevelList pending={pending} gearReady={gear !== null} onOpen={onOpen} onMastered={onMastered} />
          </div>
          <div className="flex flex-col gap-2 lg:col-span-4">
            {world ? (
              <>
                <ChoiceList title="Circuito" hint="Esta semana" names={world.circuit} known={known} onOpen={onOpen} />
                <ChoiceList title="Incarnon" hint="Circuito de acero" names={world.incarnon} known={known} onOpen={onOpen} />
              </>
            ) : (
              <p className="text-sm text-mute">{worldError ? "Sin el circuito de esta semana." : "Leyendo el circuito…"}</p>
            )}
          </div>
        </div>
        <CodaList gear={gear} mastered={collection.mastered} onOpen={onOpen} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-bone">
          Tu equipo
          {accountName ? <span className="ml-2 font-normal text-mute">{accountName}</span> : null}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <BigNumber
            label="Warframes"
            value={stats.frames}
            total={stats.frameTotal}
            percent={framePercent}
            onClick={() => onSearch("warframe", "built")}
          />
          <BigNumber
            label="Armas"
            value={stats.weapons}
            total={stats.weaponTotal}
            percent={weaponPercent}
            onClick={() => onSearch("weapon", "built")}
          />
          <SellCard copies={stats.sellCopies} items={stats.sellItemCount} onClick={onSell} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SmallMeter label="Primarias" value={stats.primary} total={stats.primaryTotal} onClick={() => onSearch("primary", "built")} />
          <SmallMeter label="Secundarias" value={stats.secondary} total={stats.secondaryTotal} onClick={() => onSearch("secondary", "built")} />
          <SmallMeter label="Cuerpo a cuerpo" value={stats.melee} total={stats.meleeTotal} onClick={() => onSearch("melee", "built")} />
          <SmallMeter label="Archwing" value={stats.archwing} total={stats.archwingTotal} onClick={() => onSearch("archwing", "built")} />
          <SmallMeter label="Archcañón" value={stats.archgun} total={stats.archgunTotal} onClick={() => onSearch("archgun", "built")} />
          <SmallMeter label="Archmelee" value={stats.archmelee} total={stats.archmeleeTotal} onClick={() => onSearch("archmelee", "built")} />
          <SmallMeter label="Compañero" value={stats.companion} total={stats.companionTotal} onClick={() => onSearch("companion", "built")} />
          <SmallMeter label="Robótico" value={stats.robotic} total={stats.roboticTotal} onClick={() => onSearch("robotic", "built")} />
          <SmallMeter label="Amps" value={stats.amp} total={stats.ampTotal} onClick={() => onSearch("amp", "built")} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <CountCard label="Planos tuyos" value={stats.ownedParts} hint={`de ${stats.partTotal}`} onClick={() => onSearch("all", "owned")} />
          <CountCard label="Listos" value={stats.ready} hint="para fundir" onClick={() => onSearch("all", "ready")} />
          <CountCard label="Casi" value={stats.almost} hint="faltan 1 o 2" onClick={() => onSearch("all", "almost")} />
        </div>
      </section>

      <WorldPanel world={world} error={worldError} />
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
      className="h-full w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-left hover:border-gold"
    >
      <p className="truncate text-[11px] font-medium tracking-[0.14em] text-gold uppercase">{label}</p>
      <p className="mt-1 text-2xl font-medium text-bone">
        {value}
        <span className="text-sm text-mute">/{total}</span>
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-gold" style={{ width: `${share}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-mute">{share}%</p>
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
      className="rounded-xl border border-line bg-panel/80 px-2.5 py-2 text-left hover:border-gold"
    >
      <p className="truncate text-[11px] text-mute">{label}</p>
      <p className="mt-0.5 text-base text-bone">
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
      className="h-full rounded-xl border border-line bg-ink px-2.5 py-2 text-left hover:border-gold"
    >
      <p className="truncate text-[11px] text-mute">{label}</p>
      <p className="mt-0.5 text-xl font-medium text-bone">{value}</p>
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
      className="h-full w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-left hover:border-gold"
    >
      <p className="truncate text-[11px] font-medium tracking-[0.14em] text-gold uppercase">Para vender</p>
      <p className="mt-1 text-2xl font-medium text-bone">{copies}</p>
      <p className="mt-1 truncate text-[11px] text-mute">
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
  const names = useNames();
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-medium text-bone">{title}</h2>
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
                className="flex w-full items-center gap-2 rounded-xl border border-line bg-panel px-2 py-1.5 text-left hover:border-gold"
              >
                {item.image && (
                  <img src={item.image} alt="" className="h-8 w-8 shrink-0 rounded-lg bg-ink object-contain" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-bone">{names.item(item.id, item.name)}</span>
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

function CodaList({
  gear,
  mastered,
  onOpen,
}: {
  gear: MasteryRow[] | null;
  mastered: string[];
  onOpen: (id: string) => void;
}) {
  const names = useNames();
  const [shop, setShop] = useState<CodaShop | null>(null);
  const done = useMemo(() => new Set(mastered), [mastered]);
  const byName = useMemo(() => {
    const map = new Map<string, MasteryRow>();
    for (const item of gear ?? []) map.set(item.name.toLowerCase(), item);
    return map;
  }, [gear]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetchCodaShop().then((next) => {
        if (!cancelled) setShop(next);
      });
    };
    load();
    const timer = window.setInterval(load, 15 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const groups = [
    { kind: "primary" as const, label: "Primaria" },
    { kind: "secondary" as const, label: "Secundaria" },
    { kind: "melee" as const, label: "Cuerpo a cuerpo" },
  ];

  return (
    <div className="mt-6">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
        <h3 className="text-sm font-medium text-bone">Coda de Eleanor</h3>
        {shop && (
          <span className="text-sm text-mute">
            Lote {shop.batch} · cambia en {formatTimeLeft(new Date(shop.until).toISOString())}
          </span>
        )}
      </div>
      <p className="text-xs text-mute">A la venta con células de corazón vivas. El elemento y el porcentaje los anotan los jugadores.</p>
      {!shop && <p className="mt-3 text-sm text-mute">Leyendo la tienda…</p>}
      {shop && !shop.reported && <p className="mt-3 text-sm text-mute">No pude leer el elemento de esta rotación.</p>}
      {shop && (
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          {groups.map((group) => (
            <div key={group.kind}>
              <p className="text-[11px] font-medium tracking-[0.14em] text-gold uppercase">{group.label}</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {shop.weapons
                  .filter((weapon) => weapon.kind === group.kind)
                  .map((weapon) => {
                    const item = byName.get(weapon.name.toLowerCase());
                    const label = names.item(item?.id ?? "", weapon.name);
                    const owned = item ? done.has(item.id) : false;
                    const bonus = weapon.element && weapon.percent != null
                      ? `${codaElement(weapon.element)} ${weapon.percent.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                      : "Sin porcentaje";
                    const body = (
                      <>
                        {item?.image && <img src={item.image} alt="" className="h-8 w-8 shrink-0 rounded-lg bg-panel object-contain" />}
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm ${owned ? "text-moss" : "text-bone"}`}>{label}</span>
                          <span className="text-xs">
                            {owned && <span className="text-mute">Dominado · </span>}
                            <span className={weapon.element ? "text-gold" : "text-mute"}>{bonus}</span>
                          </span>
                        </span>
                      </>
                    );
                    return (
                      <li key={weapon.name}>
                        {item ? (
                          <button
                            type="button"
                            onClick={() => onOpen(item.id)}
                            className="flex w-full items-center gap-2 rounded-xl border border-line bg-ink px-2 py-1.5 text-left hover:border-gold"
                          >
                            {body}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 rounded-xl border border-line bg-ink px-2 py-1.5">{body}</div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorldPanel({ world, error }: { world: WorldNow | null; error: string }) {
  const alerts = world?.alerts.slice(0, 2) ?? [];
  const events = world?.events.slice(0, 2) ?? [];
  const hiddenAlerts = (world?.hiddenAlerts ?? 0) + Math.max(0, (world?.alerts.length ?? 0) - alerts.length);
  return (
    <section className="border-t border-line pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-medium tracking-[0.16em] text-mute uppercase">Sistema</h2>
        {error && <p className="text-xs text-clay">{error}</p>}
        {!world && !error && <p className="text-xs text-mute">Leyendo el sistema…</p>}
      </div>
      {world && (
        <>
          <p className="mt-2 text-xs text-mute">
            {world.cycles.map((entry) => `${entry.label} ${entry.state} · ${entry.timeLeft}`).join("   ")}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <NoticeList title="Alertas" empty="No hay alertas activas." notices={alerts} extra={hiddenAlerts} />
            <NoticeList title="Eventos" empty="No hay eventos activos." notices={events} extra={Math.max(0, world.events.length - events.length)} />
          </div>
        </>
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
  const labels = useNames();
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-2">
      <p className="text-[11px] font-medium tracking-[0.14em] text-gold uppercase">
        {title}
        <span className="ml-2 font-normal tracking-normal text-mute normal-case">{hint}</span>
      </p>
      {names.length === 0 ? (
        <p className="mt-2 text-sm text-mute">Sin datos esta semana.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {names.map((name) => {
            const match = known.get(name.toLowerCase());
            const label = labels.item(match?.id ?? "", name);
            const className = match?.mastered
              ? "rounded-full border border-moss/40 px-2.5 py-1 text-sm text-moss"
              : "rounded-full border border-line px-2.5 py-1 text-sm text-bone hover:border-gold";
            const note = match ? (match.mastered ? "dominado" : "sin dominar") : "";
            if (!match) return <li key={name} className={className}>{label}</li>;
            return (
              <li key={name}>
                <button type="button" onClick={() => onOpen(match.id)} className={className} aria-label={`${label}, ${note}`}>
                  {label}
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
        <ul className="mt-2 flex flex-col gap-1.5">
          {notices.map((notice) => (
            <li key={notice.id} className="rounded-xl border border-line bg-ink px-2.5 py-1.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-bone">{notice.title}</span>
                <span className="shrink-0 text-xs text-gold">{notice.timeLeft}</span>
              </span>
              {notice.detail && <span className="block truncate text-xs text-mute">{notice.detail}</span>}
            </li>
          ))}
          {extra > 0 && <li className="text-xs text-mute">{extra === 1 ? "Y 1 más." : `Y ${extra} más.`}</li>}
        </ul>
      )}
    </div>
  );
}

function LevelList({
  pending,
  gearReady,
  onOpen,
  onMastered,
}: {
  pending: Array<MasteryRow & { xp: number }>;
  gearReady: boolean;
  onOpen: (id: string) => void;
  onMastered: () => void;
}) {
  const names = useNames();
  const shown = pending.slice(0, 8);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
        <h3 className="text-sm font-medium text-bone">Sin dominar</h3>
        {pending.length > shown.length && (
          <button type="button" onClick={onMastered} className="text-sm text-gold">
            Ver los {pending.length}
          </button>
        )}
      </div>
      {!gearReady && <p className="text-sm text-mute">Revisando lo que ya construiste…</p>}
      {gearReady && shown.length === 0 && <p className="text-sm text-mute">No tienes equipo construido pendiente de rango 30.</p>}
      {shown.length > 0 && (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {shown.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="flex w-full items-center gap-2 rounded-xl border border-line bg-ink px-2 py-1.5 text-left hover:border-gold"
              >
                {item.image && <img src={item.image} alt="" className="h-8 w-8 shrink-0 rounded-lg bg-panel object-contain" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-bone">{names.item(item.id, item.name)}</span>
                  <span className="text-xs text-mute">{KIND_LABEL[item.kind]} · {formatMastery(item.xp)} al rango 30</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MasteryHelp({
  targets,
  shared,
  partsReady,
  onOpen,
}: {
  targets: RelicTarget[];
  shared: Array<{ name: string; count: number }>;
  partsReady: boolean;
  onOpen: (id: string) => void;
}) {
  const names = useNames();
  return (
    <div>
      <h3 className="text-sm font-medium text-bone">Reliquias</h3>
      <p className="text-xs text-mute">Objetos sin dominar a los que les falta uno o dos planos.</p>
      {!partsReady && <p className="mt-3 text-sm text-mute">Buscando reliquias…</p>}
      {partsReady && targets.length === 0 && (
        <p className="mt-3 text-sm text-mute">
          En Marcar anota los planos que ya tienes. Si a un objeto sin dominar le faltan uno o dos, aquí sale la reliquia.
        </p>
      )}
      {shared.length > 0 && (
        <p className="mt-3 text-sm text-bone">
          {shared.map((relic) => `${relic.name} sirve para ${relic.count} piezas`).join(" · ")}
        </p>
      )}
      {targets.length > 0 && (
        <ul className="mt-3 grid gap-2 xl:grid-cols-2">
          {targets.map((target) => (
            <li key={target.itemId}>
              <button
                type="button"
                onClick={() => onOpen(target.itemId)}
                className="w-full rounded-xl border border-line bg-panel px-2.5 py-2 text-left hover:border-gold"
              >
                <span className="flex items-center gap-2">
                  {target.image && <img src={target.image} alt="" className="h-9 w-9 shrink-0 rounded-lg bg-ink object-contain" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-bone">{names.item(target.itemId, target.name)}</span>
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
    </div>
  );
}
