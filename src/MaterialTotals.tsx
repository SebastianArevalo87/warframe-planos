import { useState } from "react";
import type { CraftMaterial } from "./types.ts";
import { formatAmount } from "./lib/materials.ts";

export function MaterialTotals({ title, note, materials }: { title: string; note?: string; materials: CraftMaterial[] }) {
  if (materials.length === 0) return null;
  return (
    <section className="rounded-2xl border border-line bg-panel/80 px-4 py-3">
      <p className="text-[11px] font-medium tracking-[0.16em] text-gold uppercase">{title}</p>
      {note && <p className="mt-1 text-xs text-mute">{note}</p>}
      <div className="mt-2 max-h-72 overflow-y-auto">
        <MaterialList materials={materials} columns />
      </div>
    </section>
  );
}

export function MaterialList({
  materials,
  muted = false,
  columns = false,
}: {
  materials: CraftMaterial[];
  muted?: boolean;
  columns?: boolean;
}) {
  return (
    <ul className={columns ? "grid gap-1 sm:grid-cols-2" : "grid gap-1"}>
      {materials.map((material) => (
        <li key={material.id} className="flex min-w-0 items-center gap-2 rounded-lg bg-ink/60 px-2 py-1.5">
          <MaterialIcon image={material.image} />
          <span className={muted ? "min-w-0 flex-1 text-sm leading-snug text-mute line-through" : "min-w-0 flex-1 text-sm leading-snug text-bone"}>
            {material.name}
          </span>
          <span className="shrink-0 text-sm font-medium text-gold tabular-nums">{formatAmount(material.count)}</span>
        </li>
      ))}
    </ul>
  );
}

function MaterialIcon({ image }: { image: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) return <span className="h-8 w-8 shrink-0" aria-hidden="true" />;
  return (
    <img
      src={image}
      alt=""
      width={32}
      height={32}
      loading="lazy"
      decoding="async"
      className="h-8 w-8 shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  );
}
