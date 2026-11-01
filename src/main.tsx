import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { LocaleProvider } from "./Locale.tsx";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("No está el contenedor de la página");
createRoot(root).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
);
