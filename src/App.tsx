import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { CatalogItem, Collection, Draft, KindFilter, StatusFilter } from "./types.ts";
import { loadCollection, loadDraft, saveCollection, saveDraft } from "./lib/storage.ts";
import { loadProfile, masteryValue, saveProfile, type Profile, type Session } from "./lib/account.ts";
import { loadOrCreateRemote, saveRemoteAccount } from "./lib/remote.ts";
import { sessionFromUser, supabase, supabaseEnabled } from "./lib/supabase.ts";
import { fetchDashboard, fetchItemDetail, fetchItemList, storeCatalog, type DashboardStats, type ItemSummary } from "./lib/catalogRemote.ts";
import { refreshCatalog } from "./lib/refreshCatalog.ts";
import { ItemCard, ItemSummaryRow } from "./ItemCard.tsx";
import { Gate, LoginScreen } from "./Login.tsx";

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

function profileForm(profile: Profile) {
  return {
    warframeAccount: profile.warframeAccount,
    mastery: profile.mastery == null ? "" : String(profile.mastery),
  };
}

function listingRequested(kind: KindFilter, query: string, status: StatusFilter) {
  return kind !== "all" || query.trim().length >= 2 || status === "ready";
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseEnabled);
  const [accountReady, setAccountReady] = useState(!supabaseEnabled);
  const [accountError, setAccountError] = useState("");
  const [collection, setCollection] = useState<Collection>(() =>
    supabaseEnabled ? { parts: [], built: [], items: [] } : loadCollection(),
  );
  const [profile, setProfile] = useState(() =>
    profileForm(supabaseEnabled ? { warframeAccount: "", mastery: null } : loadProfile()),
  );
  const [draft, setDraft] = useState<Draft>(() => loadDraft());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("missing");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rows, setRows] = useState<ItemSummary[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("item"));
  const [openItem, setOpenItem] = useState<CatalogItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  useEffect(() => {
    if (!accountOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ? sessionFromUser(data.session.user) : null);
      setAuthReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ? sessionFromUser(next.user) : null);
      setAuthReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const userId = session?.sub;

  useEffect(() => {
    if (!supabaseEnabled || !userId) return;
    let cancelled = false;
    setAccountReady(false);
    setAccountError("");
    void loadOrCreateRemote(userId)
      .then((account) => {
        if (cancelled) return;
        setCollection(account.collection);
        setProfile(profileForm(account));
        setAccountReady(true);
      })
      .catch(() => {
        if (!cancelled) setAccountError("No pude abrir tu lista.");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const ownedParts = useMemo(() => new Set(collection.parts), [collection.parts]);
  const draftParts = useMemo(() => new Set(draft.parts), [draft.parts]);
  const built = useMemo(() => new Set(collection.built), [collection.built]);
  const ownedItems = useMemo(() => new Set(collection.items), [collection.items]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!accountReady || !supabaseEnabled) return;
    let cancelled = false;
    void fetchDashboard()
      .then((next) => {
        if (!cancelled) setStats(next);
      })
      .catch(() => {
        if (!cancelled) setLoadError("No pude abrir el tablero.");
      });
    return () => {
      cancelled = true;
    };
  }, [accountReady, savedTick]);

  useEffect(() => {
    if (!accountReady || !supabaseEnabled) return;
    if (!listingRequested(kindFilter, debouncedQuery, statusFilter)) {
      setRows([]);
      setListLoading(false);
      return;
    }
    let cancelled = false;
    setListLoading(true);
    setLoadError("");
    void fetchItemList(kindFilter, debouncedQuery.trim(), statusFilter)
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch(() => {
        if (!cancelled) setLoadError("No pude abrir esa lista.");
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountReady, kindFilter, debouncedQuery, statusFilter, savedTick]);

  useEffect(() => {
    function onPop() {
      setOpenId(new URLSearchParams(window.location.search).get("item"));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!openId || !accountReady) {
      setOpenItem(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void fetchItemDetail(openId)
      .then((item) => {
        if (!cancelled) setOpenItem(item);
      })
      .catch(() => {
        if (!cancelled) setLoadError("No pude abrir ese plano.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openId, accountReady]);

  const virtualizer = useWindowVirtualizer({
    count: openId ? 0 : rows.length,
    estimateSize: () => 96,
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

  function updateDraft(next: Draft) {
    setDraft(next);
  }

  function writeAccount(next: Collection, nextProfile = profile) {
    setCollection(next);
    const stored: Profile = {
      warframeAccount: nextProfile.warframeAccount.trim(),
      mastery: masteryValue(nextProfile.mastery),
    };
    if (supabaseEnabled && session) {
      void saveRemoteAccount(session.sub, { ...stored, collection: next })
        .then(() => setSavedTick((tick) => tick + 1))
        .catch(() => {
          setNotice("No pude guardar la lista. Inténtalo otra vez.");
        });
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
    if (supabaseEnabled && session) {
      void saveRemoteAccount(session.sub, { ...stored, collection }).catch(() => {
        setNotice("No pude guardar la lista. Inténtalo otra vez.");
      });
      return;
    }
    saveProfile(stored);
  }

  function logout() {
    updateDraft({ parts: [], history: [] });
    setAccountReady(false);
    setCollection({ parts: [], built: [], items: [] });
    setProfile(profileForm({ warframeAccount: "", mastery: null }));
    void supabase?.auth.signOut();
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

  function showItem(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("item", id);
    window.history.pushState({ item: id }, "", url);
    setOpenId(id);
  }

  function hideItem() {
    const url = new URL(window.location.href);
    url.searchParams.delete("item");
    window.history.pushState({}, "", url);
    setOpenId(null);
  }

  async function updateList() {
    setRefreshing(true);
    setNotice("");
    try {
      const next = await refreshCatalog();
      const added = await storeCatalog(next);
      setStats(await fetchDashboard());
      setSavedTick((tick) => tick + 1);
      setNotice(
        added > 0
          ? `Se agregaron ${added} ${added === 1 ? "entrada nueva" : "entradas nuevas"}.`
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

  if (supabaseEnabled && !authReady) {
    return <Gate title="Abriendo…" />;
  }
  if (supabaseEnabled && !session) {
    return <LoginScreen />;
  }
  if (supabaseEnabled && accountError) {
    return <Gate title={accountError} />;
  }
  if (supabaseEnabled && !accountReady) {
    return <Gate title="Abriendo tu lista…" />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16">
      <header className="pt-6 pb-4">
        <div ref={accountMenuRef} className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium tracking-[0.22em] text-gold uppercase">Warframe</p>
              <h1 className="text-3xl font-medium text-bone">Planos</h1>
            </div>
            <div className="flex items-start gap-3">
              <div className="hidden pt-1 text-right text-sm text-mute sm:block">
                <p>
                  Warframes <span className="text-bone">{stats?.frames ?? 0}</span>/{stats?.frameTotal ?? 0}
                </p>
                <p>
                  Armas <span className="text-bone">{stats?.weapons ?? 0}</span>/{stats?.weaponTotal ?? 0}
                </p>
              </div>
              <button
                type="button"
                aria-expanded={accountOpen}
                aria-controls="cuenta-menu"
                onClick={() => setAccountOpen((open) => !open)}
                className="flex max-w-40 items-center gap-2 rounded-full border border-line bg-panel py-1.5 pr-3 pl-1.5 text-sm text-bone hover:border-gold"
              >
                {session?.picture ? (
                  <img src={session.picture} alt="" className="h-7 w-7 rounded-full" />
                ) : (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs text-gold">WF</span>
                )}
                <span className="truncate">{profile.warframeAccount.trim() || "Cuenta"}</span>
              </button>
            </div>
          </div>
          {accountOpen && (
            <div
              id="cuenta-menu"
              role="dialog"
              aria-label="Cuenta"
              className="absolute inset-x-0 top-full z-30 mt-2 rounded-2xl border border-line bg-panel px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
            >
              <div className="flex items-center gap-3">
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
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Meter label="Warframes" value={stats?.frames ?? 0} total={stats?.frameTotal ?? 0} />
          <Meter label="Armas" value={stats?.weapons ?? 0} total={stats?.weaponTotal ?? 0} />
        </div>

        <label className="mt-4 block">
          <span className="sr-only">Buscar un plano</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (openId) hideItem();
            }}
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
              onClick={() => {
                setStatusFilter(filter.id);
                if (openId) hideItem();
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {KIND_FILTERS.map((filter) => (
            <FilterChip
              key={filter.id}
              active={kindFilter === filter.id}
              label={filter.label}
              onClick={() => {
                setKindFilter(filter.id);
                if (openId) hideItem();
              }}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void updateList()}
            disabled={refreshing}
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
        {stats?.sourceVersion && (
          <p className="mt-2 text-xs text-mute/80">
            {stats.partTotal} planos en la base
            {stats.ready > 0 ? ` · ${stats.ready} listos para fundir` : ""} · catálogo {stats.sourceVersion}
          </p>
        )}
      </header>

      <div ref={listRef}>
        {loadError && <p className="text-clay">{loadError}</p>}
        {openId ? (
          <div className="pb-8">
            <button type="button" onClick={hideItem} className="mb-3 text-sm text-gold">
              Volver al tablero
            </button>
            {detailLoading && <p className="text-mute">Abriendo el plano…</p>}
            {!detailLoading && !openItem && <p className="text-mute">Ese plano no está en la base.</p>}
            {openItem && (
              <ItemCard
                item={openItem}
                visiblePartIds={null}
                ownedParts={ownedParts}
                draftParts={draftParts}
                built={built.has(openItem.id)}
                ownedItem={ownedItems.has(openItem.id)}
                onPickPart={pickPart}
                onUnpickDraft={unpickDraft}
                onForgetPart={forgetPart}
                onToggleBuilt={() => toggleBuilt(openItem.id)}
                onToggleOwnedItem={() => toggleOwnedItem(openItem.id)}
              />
            )}
          </div>
        ) : (
          <>
            {!listingRequested(kindFilter, debouncedQuery, statusFilter) && (
              <p className="text-mute">
                Elige Warframes, Primarias, Secundarias o Melee, o escribe un nombre. También puedes ver los que están
                listos para fundir.
              </p>
            )}
            {listLoading && <p className="text-mute">Buscando…</p>}
            {listingRequested(kindFilter, debouncedQuery, statusFilter) && !listLoading && rows.length === 0 && (
              <p className="text-mute">Ningún plano coincide con este filtro.</p>
            )}
            <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                if (!row) return null;
                return (
                  <div
                    key={row.id}
                    ref={virtualizer.measureElement}
                    data-index={virtualRow.index}
                    className="absolute top-0 left-0 w-full pb-3"
                    style={{ transform: `translateY(${virtualRow.start - scrollMargin}px)` }}
                  >
                    <ItemSummaryRow item={row} onOpen={() => showItem(row.id)} />
                  </div>
                );
              })}
            </div>
          </>
        )}
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
