import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import { SESSION_QUERY_KEY, fetchMe } from "@/lib/session";
import type { CompanySettings, Notification, User } from "@/lib/types";

/** Current session. Never throws into the page: an unauthenticated visitor is `null`. */
export function useSession() {
  const query = useQuery<User | null>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      try {
        return await fetchMe();
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 30_000,
  });
  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isStaff: query.data?.role === "admin" || query.data?.role === "funcionario",
    isAdmin: query.data?.role === "admin",
  };
}

/** Company identity for the storefront shell — public endpoint, safe to render always. */
export function useCompany() {
  return useQuery<CompanySettings>({
    queryKey: ["settings", "company"],
    queryFn: () => apiGet<CompanySettings>("/settings/company"),
    staleTime: 5 * 60_000,
  });
}

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => apiGet<Notification[]>("/notifications"),
    refetchInterval: 60_000,
  });
}
