import { useEffect, useRef, type ReactNode } from "react";

export function Sheet({
  label,
  onClose,
  onBack,
  children,
  stacked = false,
  wide = false,
}: {
  label: string;
  onClose: () => void;
  onBack?: () => void;
  children: ReactNode;
  stacked?: boolean;
  wide?: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [label]);
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
        className={`flex max-h-[min(92dvh,44rem)] min-h-0 w-full min-w-0 max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-ink shadow-[0_24px_80px_rgba(0,0,0,0.45)] lg:max-h-[min(90dvh,56rem)] ${wide ? "lg:max-w-5xl" : "lg:max-w-3xl"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={onBack ? "flex shrink-0 items-center justify-between px-3 pt-3" : "flex shrink-0 justify-end px-3 pt-3"}>
          {onBack && (
            <button type="button" onClick={onBack} className="rounded-full px-3 py-2 text-sm text-bone">
              Volver
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-full px-3 py-2 text-sm text-gold">
            Cerrar
          </button>
        </div>
        <div ref={scrollerRef} className="min-h-0 min-w-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 pb-3">
          {children}
        </div>
      </div>
    </div>
  );
}
