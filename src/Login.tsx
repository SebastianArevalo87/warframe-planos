import { useEffect, useRef, useState } from "react";
import { sessionFromCredential, type Session } from "./lib/account.ts";

type CredentialResponse = { credential: string };

type GoogleId = {
  initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

export function LoginScreen({ clientId, onSuccess }: { clientId: string; onSuccess: (session: Session) => void }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const onSuccessRef = useRef(onSuccess);
  const [error, setError] = useState("");
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    let cancelled = false;

    function render() {
      if (cancelled || !buttonRef.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: true,
        callback: (response) => {
          const session = sessionFromCredential(response.credential, clientId);
          if (!session) {
            setError("Google no devolvió una cuenta válida.");
            return;
          }
          onSuccessRef.current(session);
        },
      });
      buttonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "filled_black",
        size: "large",
        text: "continue_with",
        shape: "pill",
        locale: "es",
        width: 320,
      });
    }

    if (window.google) {
      render();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => render();
    script.onerror = () => {
      if (!cancelled) setError("No pude cargar el acceso de Google.");
    };
    document.head.appendChild(script);
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6">
      <p className="text-[11px] font-medium tracking-[0.22em] text-gold uppercase">Warframe</p>
      <h1 className="mt-2 text-4xl font-medium text-bone">Planos</h1>
      <p className="mt-3 text-sm leading-6 text-mute">
        Entra con Google para guardar tu lista. Cada cuenta ve solo lo suyo. El nombre del juego y la maestría los
        escribes tú.
      </p>
      <div ref={buttonRef} className="mt-8 flex min-h-11 justify-center" />
      {error && <p className="mt-4 text-sm text-clay">{error}</p>}
    </div>
  );
}
