import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    // Block unauthenticated AND anonymous sessions — anon users must sign up properly
    if (!data.session || data.session.user.is_anonymous) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: () => (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  ),
});
