import { useState } from "react";
import type { CraftMaterial } from "./types.ts";
import { formatAmount, isBuiltItem } from "./lib/materials.ts";

export function MaterialTotals({
  title,
  note,
  materials,
  onOpenItem,
  spread = false,
}: {
  title: string;
  note?: string;
  materials: CraftMaterial[];
  onOpenItem?: (id: string) => void;
  spread?: boolean;
}) {
  if (materials.length === 0) return null;
  return (
    <section className="min-w-0">
      <p className="text-[11px] font-medium tracking-[0.16em] text-gold uppercase">{title}</p>
      {note && <p className="mt-1 text-xs text-mute">{note}</p>}
      <div className="mt-2">
        <MaterialList materials={materials} onOpenItem={onOpenItem} spread={spread} />
      </div>
    </section>
  );
}

export function MaterialList({
  materials,
  muted = false,
  onOpenItem,
  spread = false,
}: {
  materials: CraftMaterial[];
  muted?: boolean;
  onOpenItem?: (id: string) => void;
  spread?: boolean;
}) {
  return (
    <ul className={spread ? "flex flex-wrap gap-x-4 gap-y-1" : "flex flex-wrap gap-x-3 gap-y-1"}>
      {materials.map((material) => {
        const openable = Boolean(onOpenItem) && isBuiltItem(material.id);
        const nameClass = muted ? "text-sm leading-snug text-mute line-through" : "text-sm leading-snug text-bone";
        const body = (
          <>
            <MaterialIcon image={material.image} />
            <span className={openable ? `${nameClass} underline decoration-gold/50 underline-offset-2` : nameClass}>
              {material.name}
            </span>
            <span className="text-sm font-medium text-gold tabular-nums">{formatAmount(material.count)}</span>
          </>
        );
        return (
          <li key={material.id} className="max-w-full">
            {openable && onOpenItem ? (
              <button
                type="button"
                onClick={() => onOpenItem(material.id)}
                aria-label={`Ver requisitos de ${material.name}`}
                className="flex max-w-full items-center gap-1.5 rounded-lg px-1 py-0.5 text-left hover:bg-gold/10"
              >
                {body}
              </button>
            ) : (
              <div className="flex max-w-full items-center gap-1.5 px-1 py-0.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function MaterialIcon({ image }: { image: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) return null;
  return (
    <img
      src={image}
      alt=""
      width={24}
      height={24}
      loading="lazy"
      decoding="async"
      className="h-6 w-6 shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  );
}
