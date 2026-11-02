export function Laurel({ lit, className = "h-6 w-6" }: { lit: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={`${className} ${lit ? "text-[#c6ff7a] drop-shadow-[0_0_5px_#9dff57]" : "text-mute/40"}`} aria-hidden="true">
      <g fill="currentColor">
        <path d="M30.5 56c-1.4-3.4-.2-5.6 2-6.4 1.2 2.4.4 4.8-.6 6.6-.6-.2-.9-.2-1.4-.2z" />
        <g>
          <Leaf d="M32 52c-7-2-12 2-9 7 5-2 8-4 9-7z" />
          <Leaf d="M27 45c-9-1-13 4-9 9 6-2 8-5 9-9z" />
          <Leaf d="M22 36c-9 0-13 6-7 10 5-3 7-6 7-10z" />
          <Leaf d="M19 26c-8 1-11 8-5 11 4-4 5-7 5-11z" />
          <Leaf d="M20 16c-7 2-8 8-3 10 3-4 4-7 3-10z" />
          <Leaf d="M25 8c-5 3-5 8-1 9 2-4 2-6 1-9z" />
        </g>
        <g transform="translate(64 0) scale(-1 1)">
          <Leaf d="M32 52c-7-2-12 2-9 7 5-2 8-4 9-7z" />
          <Leaf d="M27 45c-9-1-13 4-9 9 6-2 8-5 9-9z" />
          <Leaf d="M22 36c-9 0-13 6-7 10 5-3 7-6 7-10z" />
          <Leaf d="M19 26c-8 1-11 8-5 11 4-4 5-7 5-11z" />
          <Leaf d="M20 16c-7 2-8 8-3 10 3-4 4-7 3-10z" />
          <Leaf d="M25 8c-5 3-5 8-1 9 2-4 2-6 1-9z" />
        </g>
      </g>
    </svg>
  );
}

function Leaf({ d }: { d: string }) {
  return <path d={d} />;
}
