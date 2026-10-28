export function ProfileSkeleton() {
  return <div className="min-h-screen pt-28 pb-16 px-6 max-w-2xl mx-auto animate-pulse" />
}

export function OrderCardSkeleton() {
  return <div className="h-56 rounded-2xl bg-brand-card border border-brand-border animate-pulse" />
}

export function StatCardSkeleton() {
  return <div className="h-32 rounded-2xl bg-brand-card border border-brand-border animate-pulse" />
}

export function ProductCardSkeleton({ isCarousel = false }) {
  return (
    <div
      className={`flex flex-col justify-between bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] overflow-hidden animate-pulse ${
        isCarousel ? "w-[215px] sm:w-[240px] md:w-[260px] shrink-0" : "w-full"
      }`}
    >
      <div className="relative aspect-[4/3] w-full bg-[var(--bg-sub)]" />
      <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          <div className="h-3 w-16 bg-[var(--bg-sub)] rounded-md" />
          <div className="h-4 w-3/4 bg-[var(--bg-sub)] rounded-md" />
          <div className="h-3 w-1/2 bg-[var(--bg-sub)] rounded-md" />
        </div>
        <div className="pt-1 flex items-center justify-between">
          <div className="h-4 w-14 bg-[var(--bg-sub)] rounded-md" />
          <div className="h-8 w-16 bg-[var(--bg-sub)] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
