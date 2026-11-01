import type { ReactNode } from "react";

export function Sheet({
  label,
  onClose,
  children,
  stacked = false,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div
      className={
        stacked
          ? "fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-ink/80 p-3 sm:items-center"
          : "fixed inset-0 z-40 flex items-end justify-center overflow-hidden bg-ink/80 p-3 sm:items-center"
      }
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="flex max-h-[min(92dvh,44rem)] min-h-0 w-full min-w-0 max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-ink shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 justify-end px-3 pt-3">
          <button type="button" onClick={onClose} className="rounded-full px-3 py-2 text-sm text-gold">
            Cerrar
          </button>
        </div>
        <div className="min-h-0 min-w-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 pb-3">
          {children}
        </div>
      </div>
    </div>
  );
}
