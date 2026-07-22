import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type PlatformRole =
  | "customer"
  | "rider"
  | "merchant"
  | "dispatcher"
  | "support"
  | "admin"
  | "super_admin"
  | "banned";

export const ROLE_HOME: Record<PlatformRole, string> = {
  customer: "/app",
  rider: "/rider",
  merchant: "/merchant",
  dispatcher: "/dispatcher",
  support: "/support",
  admin: "/admin",
  super_admin: "/admin",
  banned: "/",
};

const HOME_PRIORITY: PlatformRole[] = [
  "banned",
  "super_admin",
  "admin",
  "dispatcher",
  "merchant",
  "rider",
  "support",
  "customer",
];

const PLATFORM_ROLES = new Set<PlatformRole>(HOME_PRIORITY);

type RoleRow = {
  role: string | null;
};

type GuardLocation = {
  href: string;
};

function normalizeRoles(rows: RoleRow[] | null | undefined): PlatformRole[] {
  const roles = new Set<PlatformRole>();

  rows?.forEach((row) => {
    if (row.role && PLATFORM_ROLES.has(row.role as PlatformRole)) {
      roles.add(row.role as PlatformRole);
    }
  });

  roles.add("customer");
  return Array.from(roles);
}

export async function requireSession(location: GuardLocation): Promise<Session> {
  const { data } = await supabase.auth.getSession();

  if (!data.session || data.session.user.is_anonymous) {
    throw redirect({ to: "/login", search: { redirect: location.href } });
  }

  return data.session;
}

export async function fetchUserRoles(
  queryClient: QueryClient,
  userId: string,
): Promise<PlatformRole[]> {
  const roles = await queryClient.fetchQuery({
    queryKey: ["user_roles", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) throw error;
      return normalizeRoles(data);
    },
    staleTime: 1000 * 60 * 5,
  });

  return roles;
}

export async function fetchUserRolesSafe(
  queryClient: QueryClient,
  userId: string,
): Promise<PlatformRole[]> {
  try {
    return await fetchUserRoles(queryClient, userId);
  } catch (error) {
    console.warn("Could not resolve user roles", error);
    return ["customer"];
  }
}

export function getPrimaryRole(roles: readonly PlatformRole[]): PlatformRole {
  return HOME_PRIORITY.find((role) => roles.includes(role)) ?? "customer";
}

export function getRoleHome(roles: readonly PlatformRole[]): string {
  return ROLE_HOME[getPrimaryRole(roles)];
}

export function getPostAuthRedirect(requestedRedirect: string, roles: readonly PlatformRole[]) {
  if (!requestedRedirect || requestedRedirect === "/" || requestedRedirect === "/app") {
    return getRoleHome(roles);
  }

  return requestedRedirect;
}

export function hasRoleAccess(
  roles: readonly PlatformRole[],
  allowedRoles: readonly PlatformRole[],
) {
  if (roles.includes("banned")) return false;
  if (roles.includes("super_admin") || roles.includes("admin")) return true;
  return allowedRoles.some((role) => roles.includes(role));
}

export async function requireRoleAccess({
  queryClient,
  location,
  allowedRoles,
}: {
  queryClient: QueryClient;
  location: GuardLocation;
  allowedRoles: readonly PlatformRole[];
}) {
  const session = await requireSession(location);
  const roles = await fetchUserRolesSafe(queryClient, session.user.id);

  if (!hasRoleAccess(roles, allowedRoles)) {
    throw redirect({ to: getRoleHome(roles) as any });
  }

  return { session, roles };
}
