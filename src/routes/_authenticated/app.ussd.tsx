import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Smartphone } from "lucide-react";
import { EmptyState } from "@/components/rapide/EmptyState";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/app/ussd")({
  component: USSDComingSoon,
});

function USSDComingSoon() {
  const { t } = useT();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/app"
          aria-label="Back"
          className="h-10 w-10 glass rounded-full flex items-center justify-center"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-2xl font-bold">{t("ussd.title")}</h1>
      </div>

      <div className="glass rounded-3xl p-6">
        <EmptyState
          icon={Smartphone}
          title={t("ussd.coming_soon")}
          subtitle={t("ussd.coming_soon_desc")}
        />
      </div>
    </div>
  );
}
