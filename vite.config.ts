import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: "public/manifest.json", dest: "." },
        { src: "public/icon.png", dest: "." }
      ]
    })
  ],
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: path.resolve(__dirname, "src/sidepanel.html"),
        background: path.resolve(__dirname, "src/extension/background.ts"),
        contentScript: path.resolve(__dirname, "src/extension/contentScript.ts")
      },
      output: {
        assetFileNames: (_assetInfo) => "assets/[name]-[hash][extname]",
        entryFileNames: (chunk) => {
          if (chunk.name === "background") return "background.js";
          if (chunk.name === "contentScript") return "contentScript.js";
          if (chunk.name === "sidepanel") return "assets/sidepanel.js";
          return "assets/[name].js";
        }

      }
    }
  }
});
