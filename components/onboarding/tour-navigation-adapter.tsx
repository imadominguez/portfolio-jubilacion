"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";

// El adaptador de Next de nextstepjs llama a usePathname() en el render de
// <NextStep>, que envuelve toda la app fuera de cualquier <Suspense>. En rutas
// con params (/snapshots/[id]) usePathname() se suspende al prerenderizar y
// bloquea el static shell. Este adaptador lee la ruta de un store: en el server
// es "/" y en el cliente window.location; PathnameReporter (dentro de su propio
// <Suspense>) avisa cada navegación para que el tour vuelva a renderizar.

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getClientPath() {
  return window.location.pathname;
}

function getServerPath() {
  return "/";
}

export function useTourNavigationAdapter() {
  const router = useRouter();
  const pathname = useSyncExternalStore(subscribe, getClientPath, getServerPath);
  return {
    push: (path: string) => router.push(path),
    getCurrentPath: () => pathname,
  };
}

export function PathnameReporter() {
  const pathname = usePathname();
  useEffect(() => {
    for (const listener of listeners) listener();
  }, [pathname]);
  return null;
}
