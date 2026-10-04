import { SiteHeader } from "@/components/layout/site-header";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-svh flex-col bg-background noise-bg">
      <SiteHeader title="Dashboard" />
      <DashboardSkeleton />
    </div>
  );
}
