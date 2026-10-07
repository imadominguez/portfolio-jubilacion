import { SiteHeader } from "@/components/layout/site-header";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

// Vive en el grupo (dashboard) para aplicar solo a "/". En app/(app) envolvía a
// todas las rutas: su skeleton quedaba en el static shell de cada una y era lo
// primero que se pintaba antes del contenido real.
export default function Loading() {
  return (
    <div className="flex min-h-svh flex-col bg-background noise-bg">
      <SiteHeader title="Dashboard" />
      <DashboardSkeleton />
    </div>
  );
}
