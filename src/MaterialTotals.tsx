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
    <ul className={spread ? "grid gap-0.5 lg:grid-cols-2 lg:gap-x-10" : "grid gap-0.5"}>
      {materials.map((material) => {
        const openable = Boolean(onOpenItem) && isBuiltItem(material.id);
        const nameClass = muted
          ? "min-w-0 flex-1 text-sm leading-snug break-words text-mute line-through"
          : "min-w-0 flex-1 text-sm leading-snug break-words text-bone";
        const body = (
          <>
            <MaterialIcon image={material.image} />
            <span className={openable ? `${nameClass} underline decoration-gold/50 underline-offset-2` : nameClass}>
              {material.name}
            </span>
            <span className="shrink-0 text-sm font-medium text-gold tabular-nums">{formatAmount(material.count)}</span>
          </>
        );
        return (
          <li key={material.id} className="min-w-0">
            {openable && onOpenItem ? (
              <button
                type="button"
                onClick={() => onOpenItem(material.id)}
                aria-label={`Ver requisitos de ${material.name}`}
                className="flex w-full min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-gold/10"
              >
                {body}
              </button>
            ) : (
              <div className="flex min-w-0 items-center gap-2 px-1 py-1">{body}</div>
            )}
          </li>
        );
      })}
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
