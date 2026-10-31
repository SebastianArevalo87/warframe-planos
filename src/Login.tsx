import { useState, type ReactNode } from "react";
import { redirectToApp, supabase } from "./lib/supabase.ts";

export function LoginScreen() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function enter() {
    if (!supabase) return;
    setPending(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectToApp() },
    });
    if (signInError) {
      setPending(false);
      setError("No pude abrir Google. Inténtalo otra vez.");
    }
  }

  return (
    <Gate
      title="Entra con Google para guardar tu lista. Cada cuenta ve solo lo suyo, en el celular y en la computadora. El nombre del juego y la maestría los escribes tú."
      action={
        <button
          type="button"
          onClick={() => void enter()}
          disabled={pending}
          className="rounded-full bg-bone px-5 py-3 text-sm font-medium text-ink disabled:opacity-50"
        >
          {pending ? "Abriendo Google…" : "Continuar con Google"}
        </button>
      }
      error={error}
    />
  );
}

export function Gate({ title, action, error }: { title: string; action?: ReactNode; error?: string }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6">
      <p className="text-[11px] font-medium tracking-[0.22em] text-gold uppercase">Warframe</p>
      <h1 className="mt-2 text-4xl font-medium text-bone">Planos</h1>
      <p className="mt-3 text-sm leading-6 text-mute">{title}</p>
      {action && <div className="mt-8">{action}</div>}
      {error && <p className="mt-4 text-sm text-clay">{error}</p>}
    </div>
  );
}
