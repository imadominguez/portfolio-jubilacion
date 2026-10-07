import { SiteHeader } from "@/components/layout/site-header";
import { SnapshotsSkeleton } from "@/components/snapshots/snapshots-skeleton";

export default function SnapshotsLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Snapshots" description="Historial de importaciones" />
      <SnapshotsSkeleton />
    </div>
  );
}
