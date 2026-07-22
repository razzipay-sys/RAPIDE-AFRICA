import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Nav } from "@/components/rapide/Nav";
import { Hero } from "@/components/rapide/Hero";

const Features = lazy(() =>
  import("@/components/rapide/Features").then((m) => ({ default: m.Features })),
);
const Network = lazy(() =>
  import("@/components/rapide/Network").then((m) => ({ default: m.Network })),
);
const Audiences = lazy(() =>
  import("@/components/rapide/Audiences").then((m) => ({ default: m.Audiences })),
);
const CTA = lazy(() => import("@/components/rapide/CTA").then((m) => ({ default: m.CTA })));
const Footer = lazy(() =>
  import("@/components/rapide/Footer").then((m) => ({ default: m.Footer })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rapide — Livraison nouvelle génération au Bénin" },
      {
        name: "description",
        content:
          "Rapide : la plateforme de livraison instantanée du Bénin. Envoyez, suivez et recevez vos colis en temps réel.",
      },
      { property: "og:title", content: "Rapide — Livraison nouvelle génération" },
      {
        property: "og:description",
        content:
          "Logistique intelligente pour l'Afrique. Suivi en direct, paiements mobiles, coursiers vérifiés.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <Suspense fallback={null}>
          <Features />
        </Suspense>
        <Suspense fallback={null}>
          <Network />
        </Suspense>
        <Suspense fallback={null}>
          <Audiences />
        </Suspense>
        <Suspense fallback={null}>
          <CTA />
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
