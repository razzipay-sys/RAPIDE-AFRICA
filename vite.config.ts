import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// On Vercel (VERCEL=1 is auto-set during build), produce a standard Vite SPA:
//   - TanStackRouterVite handles client-only file-based routing
//   - index.html is the entry point — no SSR server needed
//   - Output goes to dist/ (standard Vite output directory)
//
// Locally, TanStack Start with full SSR dev server runs as normal.
const isVercel = !!process.env.VERCEL;

// Sentry source-map upload: only runs when SENTRY_AUTH_TOKEN is present in the
// build environment (set it in Vercel → Settings → Environment Variables).
// Required vars: SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
const sentryPlugin =
  process.env.SENTRY_AUTH_TOKEN
    ? sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: {
          // Upload source maps and then delete them so they aren't served publicly
          filesToDeleteAfterUpload: ["./dist/**/*.map"],
        },
        telemetry: false,
      })
    : null;

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
  build: {
    // Source maps required for Sentry to symbolicate stack traces
    sourcemap: true,
  },
  plugins: isVercel
    ? [
        TanStackRouterVite({ autoCodeSplitting: true }),
        tailwindcss(),
        tsConfigPaths(),
        // Sentry plugin must come AFTER other plugins so source maps are ready
        ...(sentryPlugin ? [sentryPlugin] : []),
      ]
    : [
        tanstackStart({ server: { entry: "server" } }),
        tailwindcss(),
        tsConfigPaths(),
      ],
});
