import { useEffect, useState } from "react";

const STORAGE_KEY = "wf-show-founders";

export const FOUNDER_IDS = [
  "/Lotus/Powersuits/Excalibur/ExcaliburPrime",
  "/Lotus/Weapons/Tenno/Pistol/LatoPrime",
  "/Lotus/Weapons/Tenno/Melee/LongSword/SkanaPrime",
] as const;

const FOUNDER_SET = new Set<string>(FOUNDER_IDS);

export function isFounderItem(id: string) {
  return FOUNDER_SET.has(id);
}

export function showFounders() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function storeShowFounders(value: boolean) {
  localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  window.dispatchEvent(new Event("wf-founders"));
}

export function useShowFounders() {
  const [show, setShow] = useState(showFounders);

  useEffect(() => {
    const sync = () => setShow(showFounders());
    window.addEventListener("wf-founders", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("wf-founders", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return show;
}
