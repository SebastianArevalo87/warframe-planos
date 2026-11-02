import { useEffect, useMemo, useState } from "react";
import { fetchItemIndex } from "./lib/catalogRemote.ts";
import { formatMastery, masteryXp, rankFromXp } from "./lib/mastery.ts";
import { useShowFounders } from "./lib/founders.ts";
import type { ItemKind } from "./types.ts";

export function MasteryMark({ xp, ready = true }: { xp: number; ready?: boolean }) {
  const progress = rankFromXp(xp);
  const legendary = Math.max(0, progress.rank - 30);
  const mark = legendary > 0 ? `L${legendary}` : String(progress.rank);
  const nextName = progress.rank >= 30 ? `Legendario ${progress.rank - 29}` : String(progress.rank + 1);
  const percent = Math.round((progress.into / progress.span) * 100);
  const label = ready
    ? `Maestría ${mark} por equipo dominado. ${formatMastery(progress.points)} de experiencia. Faltan ${formatMastery(progress.next - progress.points)} para ${nextName}.`
    : "Calculando la maestría del equipo dominado";

  return (
    <div className="flex items-center gap-2" aria-label={label} title={label}>
      <span className="relative grid h-11 w-11 shrink-0 place-items-center">
        <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <circle cx="32" cy="32" r="29" fill="#1c1914" stroke="#e0b15a" strokeWidth="3" />
          <circle cx="32" cy="32" r="23" fill="none" stroke="#e0b15a" strokeWidth="1.2" opacity="0.55" />
          <path d="M32 8 36 16 32 14 28 16Z" fill="#e0b15a" />
          <path d="M18 40 32 54 46 40" fill="none" stroke="#e0b15a" strokeWidth="2" />
        </svg>
        <span className={`relative -mt-1 font-medium text-gold ${mark.length > 2 ? "text-[10px]" : "text-sm"}`}>{ready ? mark : "…"}</span>
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-bone tabular-nums">{ready ? formatMastery(progress.points) : "…"}</span>
        <span className="block text-[11px] text-mute">Maestría del equipo</span>
        <span className="mt-1 block h-1 w-24 overflow-hidden rounded-full bg-line">
          <span className="block h-full bg-gold" style={{ width: `${ready ? percent : 0}%` }} />
        </span>
      </span>
    </div>
  );
}

export function MasteryBadge({ mastered, officialRank = null }: { mastered: string[]; officialRank?: number | null }) {
  if (officialRank != null) return <OfficialMark rank={officialRank} />;
  return <CalculatedBadge mastered={mastered} />;
}

function OfficialMark({ rank }: { rank: number }) {
  const legendary = Math.max(0, rank - 30);
  const mark = legendary > 0 ? `L${legendary}` : String(rank);
  const label = `Rango ${mark} del perfil oficial.`;
  return (
    <div className="flex items-center gap-2" aria-label={label} title={label}>
      <span className="relative grid h-11 w-11 shrink-0 place-items-center">
        <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <circle cx="32" cy="32" r="29" fill="#1c1914" stroke="#e0b15a" strokeWidth="3" />
          <circle cx="32" cy="32" r="23" fill="none" stroke="#e0b15a" strokeWidth="1.2" opacity="0.55" />
          <path d="M32 8 36 16 32 14 28 16Z" fill="#e0b15a" />
          <path d="M18 40 32 54 46 40" fill="none" stroke="#e0b15a" strokeWidth="2" />
        </svg>
        <span className={`relative -mt-1 font-medium text-gold ${mark.length > 2 ? "text-[10px]" : "text-sm"}`}>{mark}</span>
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-bone">Rango {mark}</span>
        <span className="block text-[11px] text-mute">Perfil oficial</span>
      </span>
    </div>
  );
}

function CalculatedBadge({ mastered }: { mastered: string[] }) {
  const foundersVisible = useShowFounders();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Array<{ id: string; kind: ItemKind }>>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchItemIndex()
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [foundersVisible]);

  const xp = useMemo(() => masteryXp(rows, mastered), [mastered, rows]);
  return <MasteryMark xp={xp} ready={ready} />;
}
