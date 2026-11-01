export const LOCALES = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" },
  { id: "pt", label: "Português" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
  { id: "it", label: "Italiano" },
  { id: "pl", label: "Polski" },
  { id: "ru", label: "Русский" },
  { id: "uk", label: "Українська" },
  { id: "tr", label: "Türkçe" },
  { id: "ja", label: "日本語" },
  { id: "ko", label: "한국어" },
  { id: "zh", label: "简体中文" },
  { id: "tc", label: "繁體中文" },
  { id: "th", label: "ไทย" },
] as const;

export type LocaleId = (typeof LOCALES)[number]["id"];

const STORAGE_KEY = "wf-locale";

const SORT_LOCALE: Record<LocaleId, string> = {
  es: "es",
  en: "en",
  pt: "pt",
  fr: "fr",
  de: "de",
  it: "it",
  pl: "pl",
  ru: "ru",
  uk: "uk",
  tr: "tr",
  ja: "ja",
  ko: "ko",
  zh: "zh-CN",
  tc: "zh-TW",
  th: "th",
};

export function isLocale(value: string | null): value is LocaleId {
  return LOCALES.some((locale) => locale.id === value);
}

export function readLocale(): LocaleId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    return "es";
  }
  return "es";
}

export function storeLocale(locale: LocaleId) {
  localStorage.setItem(STORAGE_KEY, locale);
}

export function sortLocale(locale: LocaleId) {
  return SORT_LOCALE[locale];
}
