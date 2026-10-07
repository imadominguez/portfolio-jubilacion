import { SiteHeader } from "@/components/layout/site-header";
import { SnapshotDetailSkeleton } from "@/components/snapshots/snapshot-detail-skeleton";

export default function SnapshotDetailLoading() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Snapshot" />
      <SnapshotDetailSkeleton />
    </div>
  );
}
