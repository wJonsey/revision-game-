import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths so the build works on GitHub Pages or any sub-folder.
  base: "./",
  build: {
    // Three.js is loaded as its own chunk only when a 3D match starts.
    chunkSizeWarningLimit: 800,
  },
});
