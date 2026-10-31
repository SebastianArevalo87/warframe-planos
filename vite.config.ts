import { copyFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function githubPagesFallback(): Plugin {
  return {
    name: "github-pages-fallback",
    closeBundle() {
      copyFileSync("dist/index.html", "dist/404.html");
    },
  };
}

const marketProxy = {
  "/market": {
    target: "https://api.warframe.market",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/market/, ""),
    headers: {
      "User-Agent": "warframe-planos/0.1 (personal collection tracker)",
      Accept: "application/json",
      Language: "en",
      Platform: "pc",
    },
  },
};

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss(), githubPagesFallback()],
  server: { proxy: marketProxy },
  preview: { proxy: marketProxy },
});
