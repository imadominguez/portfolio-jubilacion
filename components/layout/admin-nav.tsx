import { getViewerRole } from "@/lib/auth-session";
import { isAdminRole } from "@/lib/user-role";
import { AdminNavGroup } from "@/components/layout/app-sidebar";

// Lee la sesión: el layout lo renderiza dentro de <Suspense>.
export async function AdminNav() {
  const role = await getViewerRole();
  return isAdminRole(role) ? <AdminNavGroup /> : null;
}
