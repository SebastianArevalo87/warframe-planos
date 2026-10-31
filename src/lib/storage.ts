import type { Catalog, Collection, Draft } from "../types.ts";
import { normalizeCollection } from "./collection.ts";

const COLLECTION_KEY = "warframe-planos-collection";
const DRAFT_KEY = "warframe-planos-draft";
const CATALOG_KEY = "warframe-planos-catalog";

const emptyDraft = (): Draft => ({ parts: [], history: [] });

function readJson<T>(storage: Storage, key: string): T | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isDraft(value: Draft | null): value is Draft {
  return !!value && Array.isArray(value.parts) && Array.isArray(value.history);
}

function isCatalog(value: Catalog | null): value is Catalog {
  return !!value && Array.isArray(value.items) && typeof value.sourceVersion === "string";
}

export function loadCollection() {
  return normalizeCollection(readJson(localStorage, COLLECTION_KEY));
}

export function saveCollection(collection: Collection) {
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
}

export function loadDraft(): Draft {
  const value = readJson<Draft>(sessionStorage, DRAFT_KEY);
  return isDraft(value) ? value : emptyDraft();
}

export function saveDraft(draft: Draft) {
  if (draft.parts.length === 0) {
    sessionStorage.removeItem(DRAFT_KEY);
    return;
  }
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function loadStoredCatalog(): Catalog | null {
  const value = readJson<Catalog>(localStorage, CATALOG_KEY);
  return isCatalog(value) ? value : null;
}

export function saveStoredCatalog(catalog: Catalog) {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
}
