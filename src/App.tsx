import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogItem, Collection, KindFilter, StatusFilter } from "./types.ts";
import { loadCollection, saveCollection } from "./lib/storage.ts";
import { craftKey, emptyCollection, withAmount } from "./lib/collection.ts";
import { loadProfile, masteryValue, saveProfile, type Profile, type Session } from "./lib/account.ts";
import { loadOrCreateRemote, saveRemoteAccount } from "./lib/remote.ts";
import { sessionFromUser, supabase, supabaseEnabled } from "./lib/supabase.ts";
import { fetchDashboard, fetchItemDetail, fetchItemList, fetchSellStock, storeCatalog, type DashboardStats, type ItemSummary, type SellRow } from "./lib/catalogRemote.ts";
import { fetchPrices, type PriceQuote } from "./lib/market.ts";
import { refreshCatalog } from "./lib/refreshCatalog.ts";
import { Dashboard } from "./Dashboard.tsx";
import { SellPage } from "./SellPage.tsx";
import { LoadPage } from "./LoadPage.tsx";
import { MasteryBadge } from "./MasteryBadge.tsx";
import { FilterBar } from "./FilterBar.tsx";
import { GEAR_GRID, ItemCard, ItemTile } from "./ItemCard.tsx";
import { RelicModal } from "./RelicModal.tsx";
import { Sheet } from "./Sheet.tsx";
import { Gate, LoginScreen } from "./Login.tsx";

const KINDS: KindFilter[] = ["all", "weapon", "warframe", "primary", "secondary", "melee", "archwing", "archgun", "archmelee", "companion", "robotic", "amp"];
const STATUSES: StatusFilter[] = ["missing", "ready", "built", "almost", "owned", "all"];
const LISTING_STATUSES: StatusFilter[] = ["ready", "built", "almost", "owned"];

function profileForm(profile: Profile) {
  return {
    warframeAccount: profile.warframeAccount,
    mastery: profile.mastery == null ? "" : String(profile.mastery),
  };
}

type AppPage = "home" | "search" | "sell" | "load";

function readPage(): AppPage {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  let path = window.location.pathname;
  if (base && path.startsWith(base)) path = path.slice(base.length) || "/";
  if (path === "/vender" || path.startsWith("/vender/")) return "sell";
  if (path === "/buscar" || path.startsWith("/buscar/")) return "search";
  if (path === "/cargar" || path.startsWith("/cargar/")) return "load";
  return "home";
}

function pagePath(page: AppPage) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  if (page === "search") return `${base}/buscar`;
  if (page === "sell") return `${base}/vender`;
  if (page === "load") return `${base}/cargar`;
  return `${base}/` || "/";
}

function readFilters(): { kind: KindFilter; status: StatusFilter } {
  if (readPage() !== "search") return { kind: "all", status: "missing" };
  const params = new URLSearchParams(window.location.search);
  const kind = params.get("tipo");
  const status = params.get("estado");
  return {
    kind: KINDS.includes(kind as KindFilter) ? (kind as KindFilter) : "all",
    status: STATUSES.includes(status as StatusFilter) ? (status as StatusFilter) : "missing",
  };
}

function writeFilters(url: URL, kind: KindFilter, status: StatusFilter) {
  if (kind === "all") url.searchParams.delete("tipo");
  else url.searchParams.set("tipo", kind);
  if (status === "missing") url.searchParams.delete("estado");
  else url.searchParams.set("estado", status);
}

function listingRequested(kind: KindFilter, query: string, status: StatusFilter) {
  return kind !== "all" || query.trim().length >= 2 || LISTING_STATUSES.includes(status);
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseEnabled);
  const [accountReady, setAccountReady] = useState(!supabaseEnabled);
  const [accountError, setAccountError] = useState("");
  const [collection, setCollection] = useState<Collection>(() =>
    supabaseEnabled ? emptyCollection() : loadCollection(),
  );
  const [profile, setProfile] = useState(() =>
    profileForm(supabaseEnabled ? { warframeAccount: "", mastery: null } : loadProfile()),
  );
  const [page, setPage] = useState<AppPage>(readPage);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => readFilters().status);
  const [kindFilter, setKindFilter] = useState<KindFilter>(() => readFilters().kind);
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rows, setRows] = useState<ItemSummary[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listTotal, setListTotal] = useState(0);
  const listRequest = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [listReload, setListReload] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sellRows, setSellRows] = useState<SellRow[]>([]);
  const [sellLoading, setSellLoading] = useState(false);
  const [sellError, setSellError] = useState("");
  const [prices, setPrices] = useState<Record<string, PriceQuote | null>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("item"));
  const itemTrail = useRef<string[]>([]);
  const [canGoBack, setCanGoBack] = useState(false);
  const [relicsOpen, setRelicsOpen] = useState(false);
  const [openItem, setOpenItem] = useState<CatalogItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(() => Boolean(new URLSearchParams(window.location.search).get("item")));
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);

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

  const collectionRef = useRef(collection);
  const built = useMemo(() => new Set(collection.built), [collection.built]);

  useEffect(() => {
    collectionRef.current = collection;
  }, [collection]);

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
    if (!accountReady || !supabaseEnabled || page !== "sell") return;
    let cancelled = false;
    setSellLoading(true);
    setSellError("");
    setPricesLoading(false);
    void fetchSellStock()
      .then(async (rows) => {
        if (cancelled) return;
        setSellRows(rows);
        setSellLoading(false);
        const slugs = rows.flatMap((row) => [...row.parts.map((part) => part.slug ?? ""), row.setSlug ?? ""]);
        if (slugs.every((slug) => slug === "")) return;
        setPricesLoading(true);
        const next = await fetchPrices(slugs);
        if (!cancelled) setPrices(next);
      })
      .catch(() => {
        if (!cancelled) setSellError("No pude abrir lo que puedes vender.");
      })
      .finally(() => {
        if (!cancelled) {
          setSellLoading(false);
          setPricesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accountReady, page, savedTick]);

  useEffect(() => {
    if (!accountReady || !supabaseEnabled || page !== "search") return;
    const request = ++listRequest.current;
    if (!listingRequested(kindFilter, debouncedQuery, statusFilter)) {
      setRows([]);
      setListTotal(0);
      setListLoading(false);
      setLoadingMore(false);
      return;
    }
    setRows([]);
    setListTotal(0);
    setListLoading(true);
    setLoadingMore(false);
    setLoadError("");
    void fetchItemList(kindFilter, debouncedQuery.trim(), statusFilter, 0)
      .then((page) => {
        if (listRequest.current !== request) return;
        setRows(page.items);
        setListTotal(page.total);
      })
      .catch(() => {
        if (listRequest.current !== request) return;
        setLoadError("No pude abrir esa lista.");
      })
      .finally(() => {
        if (listRequest.current === request) setListLoading(false);
      });
  }, [accountReady, kindFilter, debouncedQuery, statusFilter, listReload, page]);

  const hasMore = rows.length < listTotal;

  useEffect(() => {
    const node = sentinelRef.current;
    if (page !== "search" || !node || !hasMore || listLoading || loadingMore || openId) return;
    const request = listRequest.current;
    const offset = rows.length;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setLoadingMore(true);
        void fetchItemList(kindFilter, debouncedQuery.trim(), statusFilter, offset)
          .then((page) => {
            if (listRequest.current !== request) return;
            setListTotal(page.total);
            setRows((current) => {
              const seen = new Set(current.map((item) => item.id));
              return [...current, ...page.items.filter((item) => !seen.has(item.id))];
            });
          })
          .catch(() => {
            if (listRequest.current === request) setLoadError("No pude cargar más planos.");
          })
          .finally(() => {
            if (listRequest.current === request) setLoadingMore(false);
          });
      },
      { rootMargin: "480px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, listLoading, loadingMore, openId, rows.length, kindFilter, debouncedQuery, statusFilter, page]);

  useEffect(() => {
    function onPop() {
      setPage(readPage());
      const filters = readFilters();
      setKindFilter(filters.kind);
      setStatusFilter(filters.status);
      const next = new URLSearchParams(window.location.search).get("item");
      if (!next) syncTrail([]);
      else if (itemTrail.current.at(-1) === next) syncTrail(itemTrail.current.slice(0, -1));
      else syncTrail([]);
      setOpenId(next);
      setDetailLoading(Boolean(next));
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

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [query, statusFilter, kindFilter]);

  useEffect(() => {
    if (!openId) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (relicsOpen) setRelicsOpen(false);
      else if (itemTrail.current.length > 0) window.history.back();
      else hideItem();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [openId, relicsOpen]);

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
    setAccountReady(false);
    setCollection(emptyCollection());
    setProfile(profileForm({ warframeAccount: "", mastery: null }));
    void supabase?.auth.signOut();
  }

  function patchOpenRow(patch: Partial<ItemSummary>) {
    if (!openItem) return;
    const id = openItem.id;
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function setPartQty(id: string, next: number) {
    const updated = withAmount(collectionRef.current, id, "parts", next);
    collectionRef.current = updated;
    writeAccount(updated);
    if (!openItem?.parts.some((part) => part.id === id)) return;
    patchOpenRow({ ownedCount: openItem.parts.filter((part) => (updated.qty[part.id] ?? 0) > 0).length });
  }

  function setItemQty(id: string, next: number) {
    const updated = withAmount(collectionRef.current, id, "items", next);
    collectionRef.current = updated;
    writeAccount(updated);
    patchOpenRow({ ownedItem: (updated.qty[id] ?? 0) > 0 });
  }

  function toggleMastered(id: string) {
    const current = collectionRef.current;
    const marking = !current.mastered.includes(id);
    const mastered = marking ? [...current.mastered, id] : current.mastered.filter((itemId) => itemId !== id);
    const builtIds = marking && !current.built.includes(id) ? [...current.built, id] : current.built;
    const updated = { ...current, mastered, built: builtIds };
    collectionRef.current = updated;
    writeAccount(updated);
    if (openItem?.id === id && marking) patchOpenRow({ built: true });
  }

  function toggleBuilt(id: string) {
    const current = collectionRef.current;
    const marking = !current.built.includes(id);
    const builtIds = marking ? [...current.built, id] : current.built.filter((itemId) => itemId !== id);
    const updated = { ...current, built: builtIds };
    collectionRef.current = updated;
    writeAccount(updated);
    if (openItem?.id === id) patchOpenRow({ built: marking });
  }

  function toggleCrafted(itemId: string, partId: string) {
    const current = collectionRef.current;
    const key = craftKey(itemId, partId);
    const crafted = current.crafted.includes(key)
      ? current.crafted.filter((entry) => entry !== key)
      : [...current.crafted, key];
    const updated = { ...current, crafted };
    collectionRef.current = updated;
    writeAccount(updated);
  }

  function openPage(next: AppPage) {
    const url = new URL(window.location.href);
    url.pathname = pagePath(next);
    url.searchParams.delete("item");
    if (next === "search") writeFilters(url, kindFilter, statusFilter);
    else {
      url.searchParams.delete("tipo");
      url.searchParams.delete("estado");
    }
    window.history.pushState({}, "", url);
    syncTrail([]);
    setPage(next);
    setOpenId(null);
    window.scrollTo({ top: 0 });
  }

  function openSearch(kind: KindFilter, status: StatusFilter) {
    setQuery("");
    setDebouncedQuery("");
    setKindFilter(kind);
    setStatusFilter(status);
    const url = new URL(window.location.href);
    url.pathname = pagePath("search");
    url.searchParams.delete("item");
    writeFilters(url, kind, status);
    window.history.pushState({}, "", url);
    syncTrail([]);
    setPage("search");
    setOpenId(null);
    window.scrollTo({ top: 0 });
  }

  function rememberFilters(kind: KindFilter, status: StatusFilter) {
    if (page !== "search") return;
    const url = new URL(window.location.href);
    writeFilters(url, kind, status);
    window.history.replaceState({}, "", url);
  }

  function syncTrail(next: string[]) {
    itemTrail.current = next;
    setCanGoBack(next.length > 0);
  }

  function showItem(id: string, nest = false) {
    if (nest && openId && openId !== id) syncTrail([...itemTrail.current, openId]);
    else syncTrail([]);
    const url = new URL(window.location.href);
    url.searchParams.set("item", id);
    window.history.pushState({ item: id }, "", url);
    setDetailLoading(true);
    setRelicsOpen(false);
    setOpenId(id);
  }

  function hideItem() {
    syncTrail([]);
    const url = new URL(window.location.href);
    url.searchParams.delete("item");
    window.history.pushState({}, "", url);
    setRelicsOpen(false);
    setOpenId(null);
  }

  async function updateList() {
    setRefreshing(true);
    setNotice("");
    try {
      const next = await refreshCatalog();
      const added = await storeCatalog(next);
      setStats(await fetchDashboard());
      setListReload((tick) => tick + 1);
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
    <div className={`mx-auto w-full px-4 pb-16 lg:px-8 ${page === "home" ? "max-w-[1600px]" : "max-w-3xl lg:max-w-6xl xl:max-w-7xl"}`}>
      <header className="pt-6 pb-4">
        <div ref={accountMenuRef} className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
              <button type="button" onClick={() => openPage("home")} className="text-left">
                <p className="text-[11px] font-medium tracking-[0.22em] text-gold uppercase">Warframe</p>
                <h1 className="text-3xl font-medium text-bone">Planos</h1>
              </button>
              <MasteryBadge mastered={collection.mastered} />
            </div>
            <div className="flex items-start gap-3">
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
                    {session ? session.email : "El nombre del juego lo escribes tú."}
                  </p>
                </div>
                {session && (
                  <button type="button" onClick={logout} className="text-sm text-mute hover:text-bone">
                    Salir
                  </button>
                )}
              </div>
              <label className="mt-3 block">
                <span className="text-xs text-mute">Cuenta de Warframe</span>
                <input
                  value={profile.warframeAccount}
                  onChange={(event) => changeProfile({ ...profile, warframeAccount: event.target.value })}
                  placeholder="Nombre#1234"
                  autoComplete="off"
                  className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-bone outline-none placeholder:text-mute/70 focus:border-gold"
                />
              </label>
              {accountHint && <p className="mt-2 text-xs text-clay">{accountHint}</p>}
            </div>
          )}
        </div>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Secciones">
          <PageTab active={page === "home"} label="Tablero" onClick={() => openPage("home")} />
          <PageTab active={page === "search"} label="Buscar" onClick={() => openPage("search")} />
          <PageTab active={page === "load"} label="Cargar" onClick={() => openPage("load")} />
          <PageTab active={page === "sell"} label="Vender" onClick={() => openPage("sell")} />
        </nav>
        {notice && <p className="mt-3 text-sm text-mute">{notice}</p>}
      </header>

      {page === "home" ? (
        <div className="flex flex-col gap-6">
          {loadError && <p className="text-clay">{loadError}</p>}
          <Dashboard
            stats={stats}
            accountName={profile.warframeAccount.trim()}
            collection={collection}
            onOpen={showItem}
            onSearch={openSearch}
            onSell={() => openPage("sell")}
            onMastered={() => {
              window.location.hash = "dominados";
              openPage("load");
            }}
          />
          <button
            type="button"
            onClick={() => void updateList()}
            disabled={refreshing}
            className="self-start rounded-full border border-line px-3 py-2 text-sm text-bone hover:border-gold disabled:opacity-50"
          >
            {refreshing ? "Actualizando…" : "Actualizar lista"}
          </button>
          {stats?.sourceVersion && (
            <p className="-mt-3 text-xs text-mute/80">Catálogo {stats.sourceVersion}</p>
          )}
        </div>
      ) : page === "load" ? (
        <LoadPage
          qty={collection.qty}
          onToggle={setPartQty}
          onOpen={showItem}
          mastered={collection.mastered}
          onToggleMastered={toggleMastered}
        />
      ) : page === "sell" ? (
        <SellPage
          rows={sellRows}
          prices={prices}
          loading={sellLoading}
          pricesLoading={pricesLoading}
          error={sellError}
          onOpen={showItem}
        />
      ) : (
        <div>
        <FilterBar
          query={query}
          onQuery={(value) => {
            setQuery(value);
            if (openId) hideItem();
          }}
          queryLabel="Buscar un plano"
          placeholder="Busca Braton, neurópticas, cañón…"
          kind={kindFilter}
          onKind={(next) => {
            setKindFilter(next);
            rememberFilters(next, statusFilter);
            if (openId) hideItem();
          }}
          status={statusFilter}
          onStatus={(next) => {
            setStatusFilter(next);
            rememberFilters(kindFilter, next);
            if (openId) hideItem();
          }}
        />

        {loadError && <p className="mt-3 text-clay">{loadError}</p>}
        {!listingRequested(kindFilter, debouncedQuery, statusFilter) && (
          <p className="mt-4 text-mute">
            Elige un tipo o un estado, o escribe un nombre. Desde el tablero, cada cuadro abre aquí el mismo conteo.
          </p>
        )}
        {listingRequested(kindFilter, debouncedQuery, statusFilter) && !listLoading && statusFilter === "owned" && stats && (
          <p className="mt-3 text-sm text-mute">
            {stats.ownedParts} {stats.ownedParts === 1 ? "plano" : "planos"} en {listTotal}{" "}
            {listTotal === 1 ? "ítem" : "ítems"}.
          </p>
        )}
        {listingRequested(kindFilter, debouncedQuery, statusFilter) && !listLoading && statusFilter !== "owned" && (
          <p className="mt-3 text-sm text-mute">
            {listTotal} {listTotal === 1 ? "ítem" : "ítems"}.
          </p>
        )}
        {listLoading && rows.length === 0 && <p className="text-mute">Buscando…</p>}
        {listingRequested(kindFilter, debouncedQuery, statusFilter) && !listLoading && rows.length === 0 && (
          <p className="text-mute">Ningún plano coincide con este filtro.</p>
        )}
        <div className={`mt-4 ${GEAR_GRID}`}>
          {rows.map((row) => (
            <ItemTile key={row.id} item={row} onOpen={() => showItem(row.id)} />
          ))}
        </div>
        {hasMore && <div ref={sentinelRef} className="h-8" />}
        {loadingMore && <p className="mt-3 text-center text-sm text-mute">Cargando más…</p>}
        {listTotal > rows.length && !loadingMore && rows.length > 0 && (
          <p className="mt-3 text-center text-xs text-mute">
            {rows.length} de {listTotal}. Sigue bajando para ver más.
          </p>
        )}
        </div>
      )}
      {openId && (
        <Sheet
          label={openItem?.name ?? "Detalle del plano"}
          onClose={hideItem}
          onBack={canGoBack ? () => window.history.back() : undefined}
          wide
        >
          {detailLoading && <p className="px-2 pb-4 text-mute">Abriendo el plano…</p>}
          {!detailLoading && !openItem && <p className="px-2 pb-4 text-mute">Ese plano no está en la base.</p>}
          {!detailLoading && openItem && (
            <ItemCard
              item={openItem}
              visiblePartIds={null}
              qty={collection.qty}
              built={built.has(openItem.id)}
              craftedParts={collection.crafted
                .filter((key) => key.startsWith(`${openItem.id}::`))
                .map((key) => key.slice(openItem.id.length + 2))}
              onToggleCrafted={(partId) => toggleCrafted(openItem.id, partId)}
              onPartQty={setPartQty}
              onItemQty={(next) => setItemQty(openItem.id, next)}
              onToggleBuilt={() => toggleBuilt(openItem.id)}
              onShowRelics={() => setRelicsOpen(true)}
              onOpenItem={(id) => showItem(id, true)}
            />
          )}
        </Sheet>
      )}
      {relicsOpen && openItem && <RelicModal item={openItem} onClose={() => setRelicsOpen(false)} />}
    </div>
  );
}

function PageTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
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

