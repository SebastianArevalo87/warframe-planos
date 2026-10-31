import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

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
  plugins: [react(), tailwindcss()],
  server: { proxy: marketProxy },
  preview: { proxy: marketProxy },
});
