import type { Collection } from "../types.ts";
import { emptyCollection, normalizeCollection } from "./collection.ts";
import { loadCollection } from "./storage.ts";

export type Session = {
  sub: string;
  name: string;
  email: string;
  picture: string;
};

export type Profile = {
  warframeAccount: string;
  mastery: number | null;
};

export type Account = Profile & {
  collection: Collection;
};

const SESSION_KEY = "warframe-planos-session";
const PROFILE_KEY = "warframe-planos-profile";
const CLAIM_KEY = "warframe-planos-claimed-by";

const emptyProfile = (): Profile => ({ warframeAccount: "", mastery: null });

function readJson(key: string): unknown {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isProfile(value: unknown): value is Profile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Profile;
  return typeof profile.warframeAccount === "string" && (profile.mastery === null || typeof profile.mastery === "number");
}

function isCollection(value: unknown): value is Collection {
  if (!value || typeof value !== "object") return false;
  const collection = value as Collection;
  return Array.isArray(collection.parts) && Array.isArray(collection.built) && Array.isArray(collection.items);
}

export function loadSession(): Session | null {
  const value = readJson(SESSION_KEY);
  if (!value || typeof value !== "object") return null;
  const session = value as Session;
  if (typeof session.sub !== "string" || typeof session.email !== "string") return null;
  return {
    sub: session.sub,
    name: typeof session.name === "string" && session.name ? session.name : session.email,
    email: session.email,
    picture: typeof session.picture === "string" ? session.picture : "",
  };
}

export function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function loadProfile(): Profile {
  const value = readJson(PROFILE_KEY);
  return isProfile(value) ? value : emptyProfile();
}

export function saveProfile(profile: Profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function accountKey(sub: string) {
  return `warframe-planos-user:${sub}`;
}

export function loadAccount(sub: string): Account | null {
  const value = readJson(accountKey(sub));
  if (!value || typeof value !== "object") return null;
  const account = value as Account;
  if (!isProfile(account) || !isCollection(account.collection)) return null;
  return { ...account, collection: normalizeCollection(account.collection) };
}

export function saveAccount(sub: string, account: Account) {
  localStorage.setItem(accountKey(sub), JSON.stringify(account));
}

export function loadOrMigrate(sub: string): Account {
  const existing = loadAccount(sub);
  if (existing) return existing;
  const claimed = localStorage.getItem(CLAIM_KEY);
  const anonymous = loadCollection();
  const profile = loadProfile();
  const hasMarks = anonymous.parts.length + anonymous.built.length + anonymous.items.length > 0;
  const hasProfile = profile.warframeAccount !== "" || profile.mastery !== null;
  const inherit = !claimed && (hasMarks || hasProfile);
  const account: Account = {
    warframeAccount: inherit ? profile.warframeAccount : "",
    mastery: inherit ? profile.mastery : null,
    collection: inherit ? anonymous : emptyCollection(),
  };
  saveAccount(sub, account);
  if (!claimed) localStorage.setItem(CLAIM_KEY, sub);
  return account;
}

export function masteryValue(value: string): number | null {
  if (value.trim() === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) return null;
  return number;
}

export function sessionFromCredential(token: string, clientId: string): Session | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    const json = JSON.parse(new TextDecoder().decode(bytes)) as {
      sub?: string;
      name?: string;
      email?: string;
      picture?: string;
      aud?: string;
      exp?: number;
    };
    if (!json.sub || !json.email || json.aud !== clientId) return null;
    if (typeof json.exp === "number" && json.exp * 1000 < Date.now()) return null;
    return {
      sub: json.sub,
      name: json.name || json.email,
      email: json.email,
      picture: json.picture ?? "",
    };
  } catch {
    return null;
  }
}
