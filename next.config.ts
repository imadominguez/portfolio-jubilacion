import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components incluye Partial Prerendering: cada ruta produce un static
  // shell y lo que depende del request o de datos sin cachear se streamea
  // detrás de <Suspense>. Ver docs/adr/0017.
  cacheComponents: true,
  // Los <Link> prefetchean un App Shell por ruta (incluye los datos de sesión,
  // cacheado por sesión en el cliente) en lugar de una prefetch por link.
  partialPrefetching: true,
  transpilePackages: ["nextstepjs"],
};

export default nextConfig;
