/** Matches Prisma `UserRole`; session strings come from Better Auth / DB. */
export const ADMIN_ROLE = "ADMIN" as const;

export function isAdminRole(role: string | undefined | null): boolean {
  return role === ADMIN_ROLE;
}
