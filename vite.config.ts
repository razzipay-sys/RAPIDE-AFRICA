import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// On Vercel (VERCEL=1 is auto-set), build as a static SPA — no SSR server needed
// since all data fetching is client-side via Supabase.
// In local dev, keep full SSR so HMR and TanStack Start dev server work normally.
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
  plugins: [
    tanstackStart(
      isVercel
        ? { spa: { enabled: true } }
        : { server: { entry: "server" } },
    ),
    tailwindcss(),
    tsConfigPaths(),
  ],
});
