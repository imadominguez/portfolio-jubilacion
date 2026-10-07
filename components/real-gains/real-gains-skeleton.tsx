import type React from "react";
import { Separator } from "@/components/ui/separator";

function SkeletonBox({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`rounded-lg bg-muted/50 animate-pulse ${className}`} style={style} />
  );
}

// Fallback del análisis de ganancia real (loading.tsx y el <Suspense> de la página).
export function RealGainsSkeleton() {
  return (
    <>
      <Separator className="opacity-30" />

      {/* KPI cards skeleton */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-3"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex flex-col gap-1.5">
              <SkeletonBox className="h-3.5 w-28" />
              <SkeletonBox className="h-3 w-20" />
            </div>
            <SkeletonBox className="h-7 w-24" />
            <SkeletonBox className="h-2.5 w-16" />
          </div>
        ))}
      </section>

      <Separator className="opacity-30" />

      {/* Breakdown bar skeleton */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-5 flex flex-col gap-4">
        <div className="flex justify-between">
          <SkeletonBox className="h-3.5 w-40" />
          <SkeletonBox className="h-3.5 w-24" />
        </div>
        <SkeletonBox className="h-7 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-2">
              <SkeletonBox className="size-2.5 rounded-full mt-1 shrink-0" />
              <div className="flex flex-col gap-1 flex-1">
                <SkeletonBox className="h-3 w-24" />
                <SkeletonBox className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="flex flex-col gap-3">
        <SkeletonBox className="h-3 w-36" />
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-muted/40 px-4 h-9 flex items-center gap-4">
            {[20, 15, 15, 15, 15, 10, 10].map((w, i) => (
              <SkeletonBox key={i} className={`h-3 w-${w}`} style={{ width: `${w}%` }} />
            ))}
          </div>
          {/* Rows */}
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="border-t border-border/60 px-4 py-3.5 flex items-center gap-4"
            >
              <div className="flex flex-col gap-1" style={{ width: "20%" }}>
                <SkeletonBox className="h-3.5 w-12" />
                <SkeletonBox className="h-2.5 w-8" />
              </div>
              {[15, 15, 15, 15, 10, 10].map((w, j) => (
                <SkeletonBox
                  key={j}
                  className="h-3.5 ml-auto"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
