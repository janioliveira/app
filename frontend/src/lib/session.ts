// Session cache ownership: every sign-out MUST route through endSession() so the
// previous account's react-query cache never renders for the next login.
import { apiGet, apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { User } from "@/lib/types";

export const SESSION_QUERY_KEY = ["auth", "me"] as const;

export const fetchMe = () => apiGet<User>("/auth/me");

export async function beginSession(): Promise<void> {
  queryClient.clear();
  await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
}

export async function endSession(): Promise<void> {
  try {
    await apiPost<{ ok: boolean }>("/auth/logout");
  } finally {
    queryClient.clear();
  }
}

export const homeForRole = (role: User["role"] | undefined): string =>
  role === "cliente" ? "/cliente" : "/admin";
