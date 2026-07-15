import { getCachedSession } from "../auth/auth";

/** Hard-coded owner account. Client gate + server RPCs both check this. */
export const ADMIN_USERNAME = "admin";

export function isAdminUsername(username: string | null | undefined): boolean {
  return (username || "").trim().toLowerCase() === ADMIN_USERNAME;
}

export function isCurrentUserAdmin(): boolean {
  return isAdminUsername(getCachedSession()?.username);
}
