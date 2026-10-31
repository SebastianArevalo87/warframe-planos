import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { Catalog, CatalogItem, Collection, Draft, KindFilter, StatusFilter } from "./types.ts";
import { loadCollection, loadDraft, loadStoredCatalog, saveCollection, saveDraft, saveStoredCatalog } from "./lib/storage.ts";
import {
  clearSession,
  loadAccount,
  loadOrMigrate,
  loadProfile,
  loadSession,
  masteryValue,
  saveAccount,
  saveProfile,
  saveSession,
  type Profile,
  type Session,
} from "./lib/account.ts";
import { refreshCatalog } from "./lib/refreshCatalog.ts";
import { ItemCard } from "./ItemCard.tsx";
import { LoginScreen } from "./Login.tsx";

const KIND_FILTERS: Array<{ id: KindFilter; label: string }> = [
  { id: "all", label: "Todo" },
  { id: "warframe", label: "Warframes" },
  { id: "primary", label: "Primarias" },
  { id: "secondary", label: "Secundarias" },
  { id: "melee", label: "Melee" },
];

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "missing", label: "Faltan" },
  { id: "ready", label: "Listos para fundir" },
  { id: "all", label: "Todos" },
];

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchesWords(haystack: string, needle: string): boolean {
  const words = fold(needle).split(/\s+/).filter(Boolean);
  const text = fold(haystack);
  return words.every((word) => text.includes(word));
}

function isComplete(item: CatalogItem, collection: Collection): boolean {
  if (collection.built.includes(item.id)) return true;
  if (item.parts.length === 0) return collection.items.includes(item.id);
  return false;
}

function ownedPartCount(item: CatalogItem, owned: Set<string>, draft: Set<string>): number {
  return item.parts.filter((part) => owned.has(part.id) || draft.has(part.id)).length;
}

function isReady(item: CatalogItem, collection: Collection, draft: Set<string>): boolean {
  if (isComplete(item, collection) || item.parts.length === 0) return false;
  return ownedPartCount(item, new Set(collection.parts), draft) === item.parts.length;
}

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

function profileForm(profile: Profile) {
  return {
    warframeAccount: profile.warframeAccount,
    mastery: profile.mastery == null ? "" : String(profile.mastery),
  };
}

function storedProfile(session: Session | null): Profile {
  if (session) return loadAccount(session.sub) ?? loadOrMigrate(session.sub);
  return loadProfile();
}

export function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [session, setSession] = useState<Session | null>(() => (clientId ? loadSession() : null));
  const [collection, setCollection] = useState<Collection>(() => {
    if (!clientId) return loadCollection();
    const current = loadSession();
    return current ? loadOrMigrate(current.sub).collection : { parts: [], built: [], items: [] };
  });
  const [profile, setProfile] = useState(() => profileForm(storedProfile(clientId ? loadSession() : null)));
  const [draft, setDraft] = useState<Draft>(() => loadDraft());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("missing");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    const stored = loadStoredCatalog();
    void fetch(`${import.meta.env.BASE_URL}catalog.json`)
      .then((response) => {
        if (!response.ok) throw new Error("catalog");
        return response.json() as Promise<Catalog>;
      })
      .then((bundled) => {
        if (stored && stored.generatedAt > bundled.generatedAt) setCatalog(stored);
        else setCatalog(bundled);
      })
      .catch(() => {
        if (stored) setCatalog(stored);
        else setLoadError("No pude abrir el catálogo de planos.");
      });
  }, []);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  const ownedParts = useMemo(() => new Set(collection.parts), [collection.parts]);
  const draftParts = useMemo(() => new Set(draft.parts), [draft.parts]);
  const built = useMemo(() => new Set(collection.built), [collection.built]);
  const ownedItems = useMemo(() => new Set(collection.items), [collection.items]);

  const visible = useMemo(() => {
    if (!catalog) return [];
    const needle = query.trim().toLowerCase();
    return catalog.items.flatMap((item) => {
      if (kindFilter !== "all" && item.kind !== kindFilter) return [];
      const complete = isComplete(item, collection);
      const ready = isReady(item, collection, draftParts);
      if (statusFilter === "missing" && complete) return [];
      if (statusFilter === "ready" && !ready) return [];

      if (!needle) return [{ item, visiblePartIds: null as string[] | null }];
      const parentHit = matchesWords(item.name, needle);
      if (parentHit) return [{ item, visiblePartIds: null }];
      const partIds = item.parts
        .filter((part) => matchesWords(`${part.title} ${part.short} ${part.english}`, needle))
        .map((part) => part.id);
      if (partIds.length === 0) return [];
      return [{ item, visiblePartIds: partIds }];
    });
  }, [catalog, collection, draftParts, kindFilter, query, statusFilter]);

  const progress = useMemo(() => {
    const items = catalog?.items ?? [];
    const frames = items.filter((item) => item.kind === "warframe");
    const weapons = items.filter((item) => item.kind !== "warframe");
    return {
      frames: frames.filter((item) => isComplete(item, collection)).length,
      frameTotal: frames.length,
      weapons: weapons.filter((item) => isComplete(item, collection)).length,
      weaponTotal: weapons.length,
    };
  }, [catalog, collection]);

  const virtualizer = useWindowVirtualizer({
    count: visible.length,
    estimateSize: () => 220,
    overscan: 8,
    scrollMargin,
  });

  useLayoutEffect(() => {
    const measure = () => {
      const next = listRef.current?.offsetTop ?? 0;
      setScrollMargin((current) => (current === next ? current : next));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [query, statusFilter, kindFilter]);

  const enter = useCallback((next: Session) => {
    const account = loadOrMigrate(next.sub);
    saveSession(next);
    setSession(next);
    setCollection(account.collection);
    setProfile(profileForm(account));
  }, []);

  function updateDraft(next: Draft) {
    setDraft(next);
  }

  function writeAccount(next: Collection, nextProfile = profile) {
    setCollection(next);
    const stored: Profile = {
      warframeAccount: nextProfile.warframeAccount.trim(),
      mastery: masteryValue(nextProfile.mastery),
    };
    if (session) {
      saveAccount(session.sub, { ...stored, collection: next });
      return;
    }
    saveCollection(next);
    saveProfile(stored);
  }

  function changeProfile(nextProfile: { warframeAccount: string; mastery: string }) {
    setProfile(nextProfile);
    const stored: Profile = {
      warframeAccount: nextProfile.warframeAccount.trim(),
      mastery: masteryValue(nextProfile.mastery),
    };
    if (session) {
      saveAccount(session.sub, { ...stored, collection });
      return;
    }
    saveProfile(stored);
  }

  function logout() {
    clearSession();
    updateDraft({ parts: [], history: [] });
    setSession(null);
    setCollection({ parts: [], built: [], items: [] });
    setProfile(profileForm({ warframeAccount: "", mastery: null }));
  }

  function pickPart(id: string) {
    if (ownedParts.has(id) || draftParts.has(id)) return;
    updateDraft({ parts: [...draft.parts, id], history: [...draft.history, id] });
  }

  function unpickDraft(id: string) {
    updateDraft({
      parts: draft.parts.filter((partId) => partId !== id),
      history: draft.history.filter((partId) => partId !== id),
    });
  }

  function undo() {
    const id = draft.history.at(-1);
    if (!id) return;
    updateDraft({
      parts: draft.parts.filter((partId) => partId !== id),
      history: draft.history.slice(0, -1),
    });
  }

  function discard() {
    updateDraft({ parts: [], history: [] });
    setNotice("Se descartó el borrador de esta partida.");
  }

  function saveDraftToCollection() {
    if (draft.parts.length === 0) return;
    const saved = draft.parts.length;
    writeAccount({
      ...collection,
      parts: [...new Set([...collection.parts, ...draft.parts])],
    });
    updateDraft({ parts: [], history: [] });
    setNotice(`Guardaste ${saved} ${saved === 1 ? "plano" : "planos"} en tu lista.`);
  }

  function toggleBuilt(id: string) {
    const builtIds = built.has(id)
      ? collection.built.filter((itemId) => itemId !== id)
      : [...collection.built, id];
    writeAccount({ ...collection, built: builtIds });
  }

  function toggleOwnedItem(id: string) {
    const items = ownedItems.has(id)
      ? collection.items.filter((itemId) => itemId !== id)
      : [...collection.items, id];
    writeAccount({ ...collection, items });
  }

  function forgetPart(id: string) {
    writeAccount({ ...collection, parts: collection.parts.filter((partId) => partId !== id) });
  }

  async function updateList() {
    if (!catalog) return;
    setRefreshing(true);
    setNotice("");
    try {
      const previous = new Set(catalog.items.map((item) => item.id));
      const next = await refreshCatalog(catalog);
      const added = next.items.filter((item) => !previous.has(item.id));
      saveStoredCatalog(next);
      setCatalog(next);
      setNotice(
        added.length > 0
          ? `Se agregaron ${added.length} ${added.length === 1 ? "entrada nueva" : "entradas nuevas"}.`
          : "La lista ya estaba al día.",
      );
    } catch {
      setNotice("No pude actualizar la lista. La que ya tienes sigue igual.");
    } finally {
      setRefreshing(false);
    }
  }

  const accountHint =
    profile.warframeAccount.trim() !== "" && !/^.+#\d+$/.test(profile.warframeAccount.trim())
      ? "Escríbela como en el juego: Nombre#1234"
      : "";

  if (clientId && !session) {
    return <LoginScreen clientId={clientId} onSuccess={enter} />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16">
      <header className="pt-6 pb-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium tracking-[0.22em] text-gold uppercase">Warframe</p>
            <h1 className="text-3xl font-medium text-bone">Planos</h1>
          </div>
          <div className="text-right text-sm text-mute">
            <p>
              Warframes <span className="text-bone">{progress.frames}</span>/{progress.frameTotal}
            </p>
            <p>
              Armas <span className="text-bone">{progress.weapons}</span>/{progress.weaponTotal}
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-line bg-panel px-4 py-3">
          <div className="flex items-center gap-3">
            {session?.picture ? (
              <img src={session.picture} alt="" className="h-9 w-9 rounded-full" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-bone">{session ? session.name : "Tu cuenta"}</p>
              <p className="truncate text-xs text-mute">
                {session ? session.email : "El nombre y la maestría los escribes tú."}
              </p>
            </div>
            {session && (
              <button type="button" onClick={logout} className="text-sm text-mute hover:text-bone">
                Salir
              </button>
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_7rem]">
            <label className="block">
              <span className="text-xs text-mute">Cuenta de Warframe</span>
              <input
                value={profile.warframeAccount}
                onChange={(event) => changeProfile({ ...profile, warframeAccount: event.target.value })}
                placeholder="Nombre#1234"
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-bone outline-none placeholder:text-mute/70 focus:border-gold"
              />
            </label>
            <label className="block">
              <span className="text-xs text-mute">Maestría</span>
              <input
                value={profile.mastery}
                onChange={(event) => changeProfile({ ...profile, mastery: event.target.value })}
                inputMode="numeric"
                placeholder="0"
                className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-bone outline-none placeholder:text-mute/70 focus:border-gold"
              />
            </label>
          </div>
          {accountHint && <p className="mt-2 text-xs text-clay">{accountHint}</p>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Meter label="Warframes" value={progress.frames} total={progress.frameTotal} />
          <Meter label="Armas" value={progress.weapons} total={progress.weaponTotal} />
        </div>

        <label className="mt-4 block">
          <span className="sr-only">Buscar un plano</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca Braton, neurópticas, cañón…"
            className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-base text-bone outline-none placeholder:text-mute/70 focus:border-gold"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <FilterChip
              key={filter.id}
              active={statusFilter === filter.id}
              label={filter.label}
              onClick={() => setStatusFilter(filter.id)}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {KIND_FILTERS.map((filter) => (
            <FilterChip
              key={filter.id}
              active={kindFilter === filter.id}
              label={filter.label}
              onClick={() => setKindFilter(filter.id)}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void updateList()}
            disabled={refreshing || !catalog}
            className="rounded-full border border-line px-3 py-2 text-sm text-bone hover:border-gold disabled:opacity-50"
          >
            {refreshing ? "Actualizando…" : "Actualizar lista"}
          </button>
          <button
            type="button"
            onClick={saveDraftToCollection}
            disabled={draft.parts.length === 0}
            className="rounded-full bg-gold px-3 py-2 text-sm font-medium text-ink disabled:opacity-40"
          >
            Guardar{draft.parts.length > 0 ? ` (${draft.parts.length})` : ""}
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={draft.history.length === 0}
            className="rounded-full px-3 py-2 text-sm text-mute disabled:opacity-40"
          >
            Deshacer
          </button>
          <button
            type="button"
            onClick={discard}
            disabled={draft.parts.length === 0}
            className="rounded-full px-3 py-2 text-sm text-mute disabled:opacity-40"
          >
            Descartar
          </button>
        </div>
        {draft.parts.length > 0 && (
          <p className="mt-2 text-sm text-gold">
            {draft.parts.length} {draft.parts.length === 1 ? "plano marcado" : "planos marcados"} en esta partida.
            Si la ronda se pierde, deshaz el último. Se graban al pulsar Guardar.
          </p>
        )}
        {notice && <p className="mt-2 text-sm text-mute">{notice}</p>}
        {catalog && (
          <p className="mt-2 text-xs text-mute/80">
            Catálogo {catalog.sourceVersion} ·{" "}
            {new Date(catalog.generatedAt).toLocaleDateString("es", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
      </header>

      <div ref={listRef}>
        {loadError && <p className="text-clay">{loadError}</p>}
        {!catalog && !loadError && <p className="text-mute">Abriendo la lista de planos…</p>}
        {catalog && visible.length === 0 && (
          <p className="text-mute">Ningún plano coincide con esta búsqueda.</p>
        )}
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = visible[virtualRow.index];
            if (!row) return null;
            return (
              <div
                key={row.item.id}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className="absolute top-0 left-0 w-full pb-3"
                style={{ transform: `translateY(${virtualRow.start - scrollMargin}px)` }}
              >
                <ItemCard
                  item={row.item}
                  visiblePartIds={row.visiblePartIds}
                  ownedParts={ownedParts}
                  draftParts={draftParts}
                  built={built.has(row.item.id)}
                  ownedItem={ownedItems.has(row.item.id)}
                  onPickPart={pickPart}
                  onUnpickDraft={unpickDraft}
                  onForgetPart={forgetPart}
                  onToggleBuilt={() => toggleBuilt(row.item.id)}
                  onToggleOwnedItem={() => toggleOwnedItem(row.item.id)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Meter({ label, value, total }: { label: string; value: number; total: number }) {
  const width = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-mute">
        <span>{label}</span>
        <span>{width}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-gold" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-bone px-3 py-1.5 text-sm text-ink"
          : "rounded-full border border-line px-3 py-1.5 text-sm text-mute hover:text-bone"
      }
    >
      {label}
    </button>
  );
}
