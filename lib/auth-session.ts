import { headers } from "next/headers";
import { cacheLife } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { auth } from "./auth";
import { isAdminRole } from "./user-role";

// Lectura de sesión con `use cache: private` (ADR-0017, guía "Authentication
// with Cache Components"):
// - Validar la sesión depende de la hora (Better Auth compara el vencimiento con
//   new Date()); sin un lifetime, Cache Components no la deja entrar al App
//   Shell que prefetchea Partial Prefetching.
// - El resultado nunca se guarda en el servidor entre requests; dentro de un
//   request deduplica las llamadas (el dashboard la invoca en paralelo).
// - stale de 5 min ("minutes"): el mínimo para entrar al App Shell. El logout
//   hace router.refresh(), que descarta el caché del cliente.
// Si la base no responde, Better Auth lanza un genérico "Failed to get session"
// que no dice qué pasó: se relanza con un mensaje propio y la causa original.
export async function getSession() {
  "use cache: private";
  cacheLife("minutes");
  const requestHeaders = await headers();
  try {
    return await auth.api.getSession({ headers: requestHeaders });
  } catch (error) {
    unstable_rethrow(error);
    throw new Error(
      "No se pudo verificar la sesión: la base de datos no respondió. Reintentá en unos segundos.",
      { cause: error }
    );
  }
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error("No autenticado");
  }
  return session;
}

// Devuelve el id del usuario autenticado o lanza. Usar en toda lectura/escritura
// de datos de usuario para garantizar el aislamiento entre cuentas.
export async function requireUserId(): Promise<string> {
  const session = await requireAuth();
  return session.user.id;
}

// Rol del usuario para decidir qué UI mostrar (p. ej. el grupo admin del
// sidebar). No autoriza nada: el proxy y requireAdmin() lo vuelven a verificar.
// Se lee desde el layout, donde un error no lo atrapa el error.tsx del segmento
// y tiraría abajo toda la app: si la sesión falla, se oculta el grupo admin y
// el error lo muestra la página, que también lee la sesión.
export async function getViewerRole(): Promise<string | null> {
  try {
    const session = await getSession();
    return session?.user.role ?? null;
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

// El proxy protege páginas, no Server Actions: una action se puede invocar
// desde cualquier página a la que el usuario tenga acceso. Toda action sobre
// datos administrados (catálogo, estrategia) tiene que chequear el rol acá.
export async function requireAdmin() {
  const session = await requireAuth();
  if (!isAdminRole(session.user.role)) {
    throw new Error("No autorizado. Se requiere rol administrador.");
  }
  return session;
}
