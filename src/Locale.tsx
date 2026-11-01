import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { gameName } from "./lib/gameName.ts";
import { readLocale, sortLocale, storeLocale, type LocaleId } from "./lib/locale.ts";

type Names = {
  locale: LocaleId;
  ready: boolean;
  item: (id: string, english: string) => string;
  part: (id: string, title: string, itemId: string, itemEnglish: string) => string;
  setLocale: (locale: LocaleId) => void;
};

const LocaleContext = createContext<Names | null>(null);
const cache = new Map<LocaleId, Record<string, string>>();

function visibleName(value: string) {
  return value.replace(/^<[^>\n]+>\s*/, "");
}

function swap(title: string, english: string, shown: string) {
  if (!english || shown === english || !title.includes(english)) return title;
  return title.split(english).join(shown);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleId>(readLocale);
  const [dict, setDict] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(locale === "en");

  useEffect(() => {
    if (locale === "en") {
      setDict({});
      setReady(true);
      return;
    }
    const saved = cache.get(locale);
    if (saved) {
      setDict(saved);
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    const url = `${import.meta.env.BASE_URL}i18n/${locale}.json`;
    void fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<Record<string, string>>;
      })
      .then((next) => {
        cache.set(locale, next);
        if (!cancelled) setDict(next);
      })
      .catch(() => {
        if (!cancelled) setDict({});
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const names = useMemo<Names>(() => {
    const item = (id: string, english: string) => {
      if (locale !== "en" && dict[id]) return visibleName(dict[id]);
      return visibleName(locale === "es" ? gameName(english) : english);
    };
    return {
      locale,
      ready,
      item,
      part: (id, title, itemId, itemEnglish) => {
        const official = dict[id];
        if (official) return official;
        const shown = item(itemId, itemEnglish);
        const replaced = swap(title, itemEnglish, shown);
        if (replaced !== title) return replaced;
        return locale === "es" ? gameName(title) : title;
      },
      setLocale: (next) => {
        storeLocale(next);
        setLocaleState(next);
        if (next === "en") setDict({});
        else setDict(cache.get(next) ?? {});
      },
    };
  }, [dict, locale, ready]);

  return <LocaleContext.Provider value={names}>{children}</LocaleContext.Provider>;
}

export function useNames() {
  const names = useContext(LocaleContext);
  if (!names) throw new Error("Falta el idioma");
  return names;
}

export function useSortLocale() {
  return sortLocale(useNames().locale);
}
