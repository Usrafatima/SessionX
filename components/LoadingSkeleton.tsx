"use client";

export function LoadingSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="glass rounded-3xl p-6">
          <div className="h-5 w-28 animate-pulse rounded-full bg-white/10" />
          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="h-20 animate-pulse rounded-2xl bg-white/8" />
            <div className="h-20 animate-pulse rounded-2xl bg-white/8" />
            <div className="h-20 animate-pulse rounded-2xl bg-white/8" />
            <div className="h-20 animate-pulse rounded-2xl bg-white/8" />
          </div>
          <div className="mt-6 h-16 animate-pulse rounded-2xl bg-white/8" />
          <div className="mt-6 h-3 animate-pulse rounded-full bg-white/8" />
        </div>
      ))}
    </div>
  );
}
