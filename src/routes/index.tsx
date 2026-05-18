import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/rapide/Nav";
import { Hero } from "@/components/rapide/Hero";
import { Features } from "@/components/rapide/Features";
import { Network } from "@/components/rapide/Network";
import { Audiences } from "@/components/rapide/Audiences";
import { CTA } from "@/components/rapide/CTA";
import { Footer } from "@/components/rapide/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rapide — Livraison nouvelle génération au Bénin" },
      { name: "description", content: "Rapide : la plateforme de livraison instantanée du Bénin. Envoyez, suivez et recevez vos colis en temps réel." },
      { property: "og:title", content: "Rapide — Livraison nouvelle génération" },
      { property: "og:description", content: "Logistique intelligente pour l'Afrique. Suivi en direct, paiements mobiles, coursiers vérifiés." },
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
        <Features />
        <Network />
        <Audiences />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
