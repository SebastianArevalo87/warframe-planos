import type { ItemKind } from "../types.ts";

const RANK_STEP = 2500;
const MR30_XP = RANK_STEP * 30 * 30;
const LEGENDARY_STEP = 147_500;

export function itemMastery(kind: ItemKind, id: string): number {
  if (kind === "warframe" || kind === "archwing" || kind === "companion" || kind === "necramech") return 6000;
  if (kind === "robotic" && id.includes("SentinelPowersuits")) return 6000;
  return 3000;
}

export function masteryXp(rows: Array<{ id: string; kind: ItemKind }>, mastered: string[]): number {
  const kinds = new Map(rows.map((row) => [row.id, row.kind]));
  let total = 0;
  for (const id of new Set(mastered)) {
    const kind = kinds.get(id);
    if (kind) total += itemMastery(kind, id);
  }
  return total;
}

export function rankFromXp(xp: number) {
  const points = Math.max(0, Math.floor(xp));
  const rank = points >= MR30_XP ? 30 + Math.floor((points - MR30_XP) / LEGENDARY_STEP) : Math.floor(Math.sqrt(points / RANK_STEP));
  const start = rank <= 30 ? RANK_STEP * rank * rank : MR30_XP + (rank - 30) * LEGENDARY_STEP;
  const nextRank = rank + 1;
  const next = nextRank <= 30 ? RANK_STEP * nextRank * nextRank : MR30_XP + (nextRank - 30) * LEGENDARY_STEP;
  return { rank, points, start, next, into: points - start, span: Math.max(1, next - start) };
}

export function formatMastery(value: number) {
  return value.toLocaleString("es-CL");
}
