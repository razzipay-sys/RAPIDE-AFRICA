import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// On Vercel (VERCEL=1 is auto-set during build), produce a standard Vite SPA:
//   - TanStackRouterVite handles client-only file-based routing
//   - index.html is the entry point — no SSR server needed
//   - Output goes to dist/ (standard Vite output directory)
//
// Locally, TanStack Start with full SSR dev server runs as normal.
const isVercel = !!process.env.VERCEL;

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  optimizeDeps: {
    esbuildOptions: {
      jsx: "automatic",
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  plugins: isVercel
    ? [
        TanStackRouterVite({ autoCodeSplitting: true }),
        tailwindcss(),
        tsConfigPaths(),
      ]
    : [
        tanstackStart({ server: { entry: "server" } }),
        tailwindcss(),
        tsConfigPaths(),
      ],
});
