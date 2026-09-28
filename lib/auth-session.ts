import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./auth";

// cache() deduplica la lectura de sesión dentro de un mismo request:
// el dashboard invoca varias acciones que llaman a getSession() en paralelo.
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

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
