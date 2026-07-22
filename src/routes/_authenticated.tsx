import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthProvider } from "@/hooks/use-auth";
import { requireSession } from "@/lib/platform-routing";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    await requireSession(location);
  },
  component: () => (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  ),
});
