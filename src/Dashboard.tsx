import { useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchAdviceParts, fetchItemIndex, type DashboardHighlight, type DashboardStats, type MasteryRow } from "./lib/catalogRemote.ts";
import { formatMastery } from "./lib/mastery.ts";
import { readyToMaster, relicTargets, sharedRelics, type AdvicePart, type RelicTarget } from "./lib/relicAdvice.ts";
import { fetchCodaShop, codaElement, type CodaShop } from "./lib/coda.ts";
import { fetchWorld, formatTimeLeft, type WorldNow } from "./lib/worldstate.ts";
import { fetchVendors, offerLabel, type Shop, type VendorBoard } from "./lib/vendors.ts";
import { useNames } from "./Locale.tsx";
import { useShowFounders } from "./lib/founders.ts";
import { FarmPlan } from "./FarmPlan.tsx";
import { KIND_LABEL, type Collection, type ItemKind, type KindFilter, type ProfileDossier, type StatusFilter } from "./types.ts";
import { alignmentLabel, markLabel, syndicateName } from "./lib/officialProfile.ts";
import type { MasteryGroupId } from "./MasteryPage.tsx";

type SectionId = "alerts" | "vendors" | "weather" | "mastery" | "farm";

export function Dashboard({
  stats,
  accountName,
  collection,
  onOpen,
  onSearch,
  onSell,
  onMastered,
  onToggleBuilt,
  onToggleCrafted,
  onToggleGoal,
  onPartQty,
}: {
  stats: DashboardStats | null;
  accountName: string;
  collection: Collection;
  onOpen: (id: string) => void;
  onSearch: (kind: KindFilter, status: StatusFilter) => void;
  onSell: () => void;
  onMastered: (group?: MasteryGroupId) => void;
  onToggleBuilt: (id: string) => void;
  onToggleCrafted: (itemId: string, partId: string) => void;
  onToggleGoal: (id: string) => void;
  onPartQty: (partId: string, next: number) => void;
}) {
  const foundersVisible = useShowFounders();
  const [world, setWorld] = useState<WorldNow | null>(null);
  const [vendors, setVendors] = useState<VendorBoard | null>(null);
  const [coda, setCoda] = useState<CodaShop | null>(null);
  const [worldError, setWorldError] = useState("");
  const [section, setSection] = useState<SectionId | null>(null);
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
      void fetchVendors()
        .then((next) => {
          if (!cancelled) setVendors(next);
        })
        .catch(() => {
          if (!cancelled) setVendors(null);
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
    const load = () => {
      void fetchCodaShop().then((next) => {
        if (!cancelled) setCoda(next);
      });
    };
    load();
    const timer = window.setInterval(load, 15 * 60_000);
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

  const masteredCount = useMemo(() => {
    const done = new Set(collection.mastered);
    const tally = (match: (kind: ItemKind) => boolean) => {
      let owned = 0;
      let total = 0;
      for (const row of gear ?? []) {
        if (!match(row.kind)) continue;
        total += 1;
        if (done.has(row.id)) owned += 1;
      }
      return { owned, total };
    };
    return {
      frames: tally((kind) => kind === "warframe"),
      weapons: tally((kind) => kind === "primary" || kind === "secondary" || kind === "melee"),
      primary: tally((kind) => kind === "primary"),
      secondary: tally((kind) => kind === "secondary"),
      melee: tally((kind) => kind === "melee"),
      archwing: tally((kind) => kind === "archwing" || kind === "necramech" || kind === "vehicle"),
      archgun: tally((kind) => kind === "archgun"),
      archmelee: tally((kind) => kind === "archmelee"),
      companion: tally((kind) => kind === "companion"),
      robotic: tally((kind) => kind === "robotic"),
      amp: tally((kind) => kind === "amp"),
    };
  }, [collection.mastered, gear]);

  if (!stats) return <p className="text-mute">Abriendo el farmeo…</p>;

  const framePercent = percent(masteredCount.frames.owned, masteredCount.frames.total);
  const weaponPercent = percent(masteredCount.weapons.owned, masteredCount.weapons.total);

  return (
    <div>
      {section === null && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Gate
            kicker="Tu farmeo"
            title={collection.goals.length === 0 ? "Nada elegido" : collection.goals.length === 1 ? "1 elegido" : `${collection.goals.length} elegidos`}
            hint="El plan de lo que marcaste: de dónde sale cada plano."
            onOpen={() => setSection("farm")}
          >
            <Preview>{collection.goals.length > 0 ? "Ver el camino" : "Elige en Marcar"}</Preview>
          </Gate>
          <Gate
            kicker="Alertas"
            title={world ? `${world.alerts.length} activas` : worldError ? "Sin conexión" : "Leyendo…"}
            hint={world?.alerts[0] ? `${world.alerts[0].title} · ${world.alerts[0].timeLeft}` : world ? "No hay alertas ahora." : "Misiones con recompensa y eventos."}
            onOpen={() => setSection("alerts")}
          >
            {world?.events.slice(0, 2).map((event) => (
              <Preview key={event.id}>{event.title}</Preview>
            ))}
          </Gate>
          <Gate
            kicker="Vendedores"
            title={vendors ? `${vendors.shops.length + 1} tiendas` : "Leyendo…"}
            hint="Teshin, Baro, Varzia, Darvo y Eleanor, sin recorrer el mapa."
            onOpen={() => setSection("vendors")}
          >
            {vendors?.shops.map((shop) => (
              <Preview key={shop.id}>{shop.name}</Preview>
            ))}
            <Preview>Eleanor</Preview>
          </Gate>
          <Gate
            kicker="Clima"
            title={world?.cycles[0] ? `${world.cycles[0].label} · ${world.cycles[0].state}` : "Leyendo…"}
            hint={world?.cycles[0] ? world.cycles[0].timeLeft : "Día, noche y ciclos de los mundos abiertos."}
            onOpen={() => setSection("weather")}
          >
            {world?.cycles.slice(1).map((entry) => (
              <Preview key={entry.label}>{`${entry.label} ${entry.state}`}</Preview>
            ))}
          </Gate>
          <Gate
            kicker="Maestría"
            title={gear ? `${framePercent}% warframes` : "Contando…"}
            hint={gear ? `${weaponPercent}% armas · ${stats.ready} listos · ${stats.almost} casi` : "Reliquias, fundición y lo que te falta por dominar."}
            onOpen={() => setSection("mastery")}
          >
            <Preview>{gear ? `${masteredCount.frames.owned}/${masteredCount.frames.total}` : "…"}</Preview>
            <Preview>{gear ? `${masteredCount.weapons.owned} armas` : "…"}</Preview>
          </Gate>
        </div>
      )}

      {section === "farm" && (
        <Detail title="Tu farmeo" hint="Escribí qué plano te cayó y sumalo al toque. Ya lo farmeé lo saca del plan." onBack={() => setSection(null)}>
          <FarmPlan
            goals={collection.goals}
            collection={collection}
            onOpen={onOpen}
            onRemove={onToggleGoal}
            onPartQty={onPartQty}
            onToggleBuilt={onToggleBuilt}
            onToggleCrafted={onToggleCrafted}
          />
        </Detail>
      )}

      {section === "alerts" && (
        <Detail title="Alertas" hint="Lo que está activo ahora en el sistema." onBack={() => setSection(null)}>
          {worldError && <p className="text-sm text-clay">{worldError}</p>}
          {!world && !worldError && <p className="text-sm text-mute">Leyendo las alertas…</p>}
          {world && (
            <div className="grid gap-6 lg:grid-cols-2">
              <NoticeList title="Alertas" empty="No hay alertas activas." notices={world.alerts} extra={0} />
              <NoticeList title="Eventos" empty="No hay eventos activos." notices={world.events} extra={0} />
            </div>
          )}
        </Detail>
      )}

      {section === "vendors" && (
        <Detail title="Vendedores" hint="Qué tiene cada uno, y cuánto falta para que rote." onBack={() => setSection(null)}>
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
            {vendors?.shops.map((shop) => (
              <VendorCard key={shop.id} shop={shop} />
            ))}
            {!vendors && <p className="text-sm text-mute">Leyendo las tiendas…</p>}
            <div className="rounded-2xl border border-line bg-panel p-3">
              <p className="text-[11px] font-medium tracking-[0.14em] text-gold uppercase">
                Eleanor
                <span className="ml-2 font-normal tracking-normal text-mute normal-case">
                  {coda ? `Lote ${coda.batch} · ${formatTimeLeft(new Date(coda.until).toISOString())}` : "Armas Coda"}
                </span>
              </p>
              <p className="mt-1 text-xs text-mute">Höllvania · la tienda rota cada 4 días.</p>
              <CodaList shop={coda} gear={gear} mastered={collection.mastered} onOpen={onOpen} />
            </div>
            {world && (
              <div className="flex flex-col gap-3">
                <ChoiceList title="Teshin · Circuito" hint="Esta semana" names={world.circuit} known={known} onOpen={onOpen} />
                <ChoiceList title="Teshin · Incarnon" hint="Circuito de acero" names={world.incarnon} known={known} onOpen={onOpen} />
              </div>
            )}
          </div>
        </Detail>
      )}

      {section === "weather" && (
        <Detail title="Clima" hint="El ciclo de cada mundo abierto." onBack={() => setSection(null)}>
          {worldError && <p className="text-sm text-clay">{worldError}</p>}
          {!world && !worldError && <p className="text-sm text-mute">Leyendo los ciclos…</p>}
          {world && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {world.cycles.map((entry) => (
                <article key={entry.label} className="rounded-2xl border border-line bg-panel p-4">
                  <p className="text-[11px] font-medium tracking-[0.16em] text-gold uppercase">{entry.label}</p>
                  <p className="mt-2 text-2xl font-medium text-bone">{entry.state}</p>
                  <p className="mt-1 text-sm text-mute">{entry.timeLeft}</p>
                </article>
              ))}
            </div>
          )}
        </Detail>
      )}

      {section === "mastery" && (
        <Detail
          title="Maestría"
          hint={collection.dossier ? `Rango ${collection.dossier.rank} en el perfil oficial.` : accountName ? accountName : "Lo marcas a mano. Aquí está lo que te acerca al siguiente rango."}
          onBack={() => setSection(null)}
        >
          {collection.dossier && <ProfileCard dossier={collection.dossier} />}
          <div className={`${collection.dossier ? "mt-6 " : ""}grid grid-cols-1 gap-6 lg:grid-cols-12`}>
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
          <div className="mt-6">
            <LevelList pending={pending} gearReady={gear !== null} onOpen={onOpen} onMastered={() => onMastered()} />
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              <BigNumber label="Warframes" value={gear ? masteredCount.frames.owned : null} total={masteredCount.frames.total} percent={framePercent} onClick={() => onMastered("warframe")} />
              <BigNumber label="Armas" value={gear ? masteredCount.weapons.owned : null} total={masteredCount.weapons.total} percent={weaponPercent} onClick={() => onMastered("primary")} />
              <SellCard copies={stats.sellCopies} items={stats.sellItemCount} onClick={onSell} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <SmallMeter label="Primarias" value={gear ? masteredCount.primary.owned : null} total={masteredCount.primary.total} onClick={() => onMastered("primary")} />
              <SmallMeter label="Secundarias" value={gear ? masteredCount.secondary.owned : null} total={masteredCount.secondary.total} onClick={() => onMastered("secondary")} />
              <SmallMeter label="Cuerpo a cuerpo" value={gear ? masteredCount.melee.owned : null} total={masteredCount.melee.total} onClick={() => onMastered("melee")} />
              <SmallMeter label="Vehículo" value={gear ? masteredCount.archwing.owned : null} total={masteredCount.archwing.total} onClick={() => onMastered("vehicle")} />
              <SmallMeter label="Archcañón" value={gear ? masteredCount.archgun.owned : null} total={masteredCount.archgun.total} onClick={() => onMastered("archgun")} />
              <SmallMeter label="Archmelee" value={gear ? masteredCount.archmelee.owned : null} total={masteredCount.archmelee.total} onClick={() => onMastered("archmelee")} />
              <SmallMeter label="Compañero" value={gear ? masteredCount.companion.owned : null} total={masteredCount.companion.total} onClick={() => onMastered("companion")} />
              <SmallMeter label="Robótico" value={gear ? masteredCount.robotic.owned : null} total={masteredCount.robotic.total} onClick={() => onMastered("robotic")} />
              <SmallMeter label="Amps" value={gear ? masteredCount.amp.owned : null} total={masteredCount.amp.total} onClick={() => onMastered("amp")} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <CountCard label="Planos tuyos" value={stats.ownedParts} hint={`de ${stats.partTotal}`} onClick={() => onSearch("all", "owned")} />
              <CountCard label="Listos" value={stats.ready} hint="para fundir" onClick={() => onSearch("all", "ready")} />
              <CountCard label="Casi" value={stats.almost} hint="faltan 1 o 2" onClick={() => onSearch("all", "almost")} />
            </div>
          </div>
        </Detail>
      )}
    </div>
  );
}

function ProfileCard({ dossier }: { dossier: ProfileDossier }) {
  const since = Date.parse(dossier.created);
  const played = `${Math.round(dossier.timePlayedSec / 3600).toLocaleString("es")} h`;
  const railjack = [dossier.intrinsics.piloting, dossier.intrinsics.gunnery, dossier.intrinsics.engineering, dossier.intrinsics.tactical, dossier.intrinsics.command];
  const drifter = [dossier.intrinsics.riding, dossier.intrinsics.combat, dossier.intrinsics.opportunity, dossier.intrinsics.endurance];
  const marks = [...new Set(dossier.marks.map(markLabel).filter(Boolean))];
  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.16em] text-gold uppercase">Perfil oficial</p>
          <p className="mt-1 text-2xl font-medium text-bone">
            {dossier.displayName}
            <span className="ml-2 text-sm text-mute">rango {dossier.rank}</span>
          </p>
          <p className="mt-1 text-sm text-mute">
            {dossier.clan ? `${dossier.clan}${dossier.clanTier == null ? "" : ` · clan ${dossier.clanTier}`}` : "Sin clan"}
            {Number.isFinite(since) ? ` · desde ${new Date(since).toLocaleDateString("es", { month: "short", year: "numeric" })}` : ""}
          </p>
        </div>
        <p className="text-sm text-mute">
          {played} · {dossier.missionsCompleted.toLocaleString("es")} hechas · {dossier.missionsFailed.toLocaleString("es")} fallidas
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Mini label="Mapa estelar" value={String(dossier.nodes)} />
        <Mini label="Camino de acero" value={String(dossier.steel)} />
        <Mini label="Alineación" value={`${alignmentLabel(dossier.alignment.value)} · ${dossier.alignment.wisdom}`} />
        <Mini label="Marcas" value={marks.length > 0 ? marks.join(", ") : "Ninguna"} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Mini label="Railjack" value={railjack.join(" / ")} />
        <Mini label="Drifter" value={drifter.join(" / ")} />
      </div>
      {dossier.founder && <p className="mt-3 text-xs text-gold">Tiene la medalla de fundador.</p>}
      {dossier.syndicates.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {dossier.syndicates.map((row) => (
            <li key={row.tag} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-bone">{syndicateName(row.tag)}</span>
              <span className="shrink-0 text-mute">
                {row.title < 0 ? "enemigo" : `rango ${row.title}`}
                <span className="ml-2">{row.standing.toLocaleString("es")}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-ink/40 px-3 py-2">
      <p className="text-[11px] font-medium tracking-[0.14em] text-gold uppercase">{label}</p>
      <p className="mt-1 text-sm text-bone">{value}</p>
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
  value: number | null;
  total: number;
  percent: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={value == null ? `${label}: contando dominados` : `${label}: ${value} de ${total} dominados. Abrir la lista.`}
      className="h-full w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-left hover:border-gold"
    >
      <p className="truncate text-[11px] font-medium tracking-[0.14em] text-gold uppercase">{label}</p>
      <p className="mt-1 text-2xl font-medium text-bone">
        {value ?? "…"}
        {value != null && <span className="text-sm text-mute">/{total}</span>}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-gold" style={{ width: `${share}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-mute">{value == null ? "Dominados" : `${share}% dominados`}</p>
    </button>
  );
}

function SmallMeter({ label, value, total, onClick }: { label: string; value: number | null; total: number; onClick: () => void }) {
  const share = percent(value ?? 0, total);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={value == null ? `${label}: contando dominados` : `${label}: ${value} de ${total} dominados. Abrir la lista.`}
      className="rounded-xl border border-line bg-panel/80 px-2.5 py-2 text-left hover:border-gold"
    >
      <p className="truncate text-[11px] text-mute">{label}</p>
      <p className="mt-0.5 text-base text-bone">
        {value ?? "…"}
        {value != null && <span className="text-sm text-mute">/{total}</span>}
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
  shop,
  gear,
  mastered,
  onOpen,
}: {
  shop: CodaShop | null;
  gear: MasteryRow[] | null;
  mastered: string[];
  onOpen: (id: string) => void;
}) {
  const names = useNames();
  const done = useMemo(() => new Set(mastered), [mastered]);
  const byName = useMemo(() => {
    const map = new Map<string, MasteryRow>();
    for (const item of gear ?? []) map.set(item.name.toLowerCase(), item);
    return map;
  }, [gear]);

  const weapons = shop
    ? [...shop.weapons].sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || a.name.localeCompare(b.name, "es"))
    : [];

  if (weapons.length === 0) return <p className="mt-2 text-sm text-mute">Leyendo la tienda…</p>;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {weapons.map((weapon) => {
        const item = byName.get(weapon.name.toLowerCase());
        const label = names.item(item?.id ?? "", weapon.name);
        const owned = item ? done.has(item.id) : false;
        const percent = weapon.percent == null
          ? ""
          : weapon.percent.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const bonus = weapon.element && percent ? `${codaElement(weapon.element)} ${percent}%` : percent ? `${percent}%` : "";
        const text = bonus ? `${label} · ${bonus}` : label;
        const className = owned
          ? "rounded-full border border-moss/40 px-2.5 py-1 text-sm text-moss"
          : "rounded-full border border-line px-2.5 py-1 text-sm text-bone hover:border-gold";
        const note = owned ? "dominado" : "sin dominar";
        if (!item) return <li key={weapon.name} className={className}>{text}</li>;
        return (
          <li key={weapon.name}>
            <button type="button" onClick={() => onOpen(item.id)} className={className} aria-label={`${text}, ${note}`}>
              {text}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Gate({
  kicker,
  title,
  hint,
  onOpen,
  children,
}: {
  kicker: string;
  title: string;
  hint: string;
  onOpen: () => void;
  children?: ReactNode;
}) {
  return (
    <button type="button" onClick={onOpen} className="flex h-full min-w-0 flex-col rounded-2xl border border-line bg-panel p-4 text-left hover:border-gold">
      <span className="text-[11px] font-medium tracking-[0.16em] text-gold uppercase">{kicker}</span>
      <span className="mt-2 text-2xl font-medium text-bone">{title}</span>
      <span className="mt-1 text-sm text-mute">{hint}</span>
      {children && <span className="mt-3 flex flex-wrap gap-1.5">{children}</span>}
    </button>
  );
}

function Preview({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-line px-2.5 py-1 text-xs text-bone">{children}</span>;
}

function Detail({ title, hint, onBack, children }: { title: string; hint: string; onBack: () => void; children: ReactNode }) {
  return (
    <section>
      <button type="button" onClick={onBack} className="text-sm text-gold">
        Volver
      </button>
      <h2 className="mt-2 text-xl font-medium text-bone">{title}</h2>
      <p className="mt-1 text-sm text-mute">{hint}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function VendorCard({ shop }: { shop: Shop }) {
  const names = useNames();
  const when = shop.here ? `se va en ${shop.timeLeft}` : shop.timeLeft ? `llega en ${shop.timeLeft}` : "fuera";
  return (
    <article className="min-w-0 self-start rounded-2xl border border-line bg-panel p-3">
      <p className="text-[11px] font-medium tracking-[0.14em] text-gold uppercase">
        {shop.name}
        <span className="ml-2 font-normal tracking-normal text-mute normal-case">{when}</span>
      </p>
      {shop.place && <p className="mt-1 text-xs text-mute">{shop.place}</p>}
      {shop.id === "teshin" && shop.offers.length > 0 && <p className="mt-3 text-xs text-mute">Rotación semanal</p>}
      {shop.offers.length === 0 ? (
        <p className="mt-2 text-sm text-mute">{shop.here ? "Sin stock publicado." : "Todavía no abrió el inventario."}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {shop.offers.map((offer) => (
            <li
              key={offer.id}
              className={
                offer.current
                  ? "rounded-full border border-gold/50 px-2.5 py-1 text-sm text-gold"
                  : "rounded-full border border-line px-2.5 py-1 text-sm text-bone"
              }
            >
              {names.item(offer.id, offerLabel(offer.name, names.locale))}
              {offer.detail ? ` · ${offer.detail}` : ""}
            </li>
          ))}
        </ul>
      )}
      {shop.always.length > 0 && (
        <>
          <p className="mt-3 text-xs text-mute">Siempre</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {shop.always.map((offer) => (
              <li key={offer.id} className="rounded-full border border-line px-2.5 py-1 text-sm text-mute">
                {offerLabel(offer.name, names.locale)}
                {offer.detail ? ` · ${offer.detail}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
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
