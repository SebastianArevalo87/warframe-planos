import type { CraftMaterial } from "./types.ts";
import { formatAmount } from "./lib/materials.ts";

export function MaterialTotals({ title, note, materials }: { title: string; note?: string; materials: CraftMaterial[] }) {
  if (materials.length === 0) return null;
  return (
    <section className="rounded-2xl border border-line bg-panel/80 px-4 py-3">
      <p className="text-[11px] font-medium tracking-[0.16em] text-gold uppercase">{title}</p>
      {note && <p className="mt-1 text-xs text-mute">{note}</p>}
      <ul className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
        {materials.map((material) => (
          <li key={material.id} className="rounded-full border border-line bg-ink px-2.5 py-1 text-xs text-bone">
            {material.name} <span className="text-gold">{formatAmount(material.count)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
