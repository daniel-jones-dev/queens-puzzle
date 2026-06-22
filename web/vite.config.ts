import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves the site under /queens-puzzle/ — keep base in sync with the repo name.
  base: "/queens-puzzle/",
  plugins: [react()],
  worker: {
    format: "es",
  },
  build: {
    target: "esnext",
  },
});
