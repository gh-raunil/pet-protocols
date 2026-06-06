export function ProductCardSkeleton() {
  return (
    <div className="bg-brand-card rounded-3xl overflow-hidden border border-brand-border animate-pulse">
      <div className="h-52 bg-brand-border" />
      <div className="p-5 space-y-3">
        <div className="h-3 bg-brand-border rounded-full w-1/3" />
        <div className="h-5 bg-brand-border rounded-full w-3/4" />
        <div className="h-3 bg-brand-border rounded-full w-full" />
        <div className="h-3 bg-brand-border rounded-full w-2/3" />
        <div className="h-10 bg-brand-border rounded-full mt-4" />
      </div>
    </div>
  )
}

export function OrderCardSkeleton() {
  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6 animate-pulse">
      <div className="flex justify-between mb-4">
        <div className="space-y-2">
          <div className="h-3 bg-brand-border rounded-full w-16" />
          <div className="h-4 bg-brand-border rounded-full w-32" />
        </div>
        <div className="space-y-2 text-right">
          <div className="h-3 bg-brand-border rounded-full w-24" />
          <div className="h-6 bg-brand-border rounded-full w-16" />
        </div>
      </div>
      <div className="border-t border-brand-border my-4" />
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-brand-border shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-brand-border rounded-full w-1/2" />
              <div className="h-3 bg-brand-border rounded-full w-1/4" />
            </div>
            <div className="h-4 bg-brand-border rounded-full w-16" />
          </div>
        ))}
      </div>
      <div className="border-t border-brand-border mt-4 pt-4 flex justify-between">
        <div className="h-4 bg-brand-border rounded-full w-24" />
        <div className="h-6 bg-brand-border rounded-full w-20" />
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto animate-pulse space-y-6 pt-28 px-6">
      <div className="bg-brand-card border border-brand-border rounded-2xl p-8 text-center">
        <div className="w-24 h-24 rounded-full bg-brand-border mx-auto mb-4" />
        <div className="h-6 bg-brand-border rounded-full w-48 mx-auto mb-2" />
        <div className="h-4 bg-brand-border rounded-full w-32 mx-auto" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5">
          <div className="h-8 bg-brand-border rounded-full w-16 mx-auto mb-2" />
          <div className="h-3 bg-brand-border rounded-full w-24 mx-auto" />
        </div>
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5">
          <div className="h-8 bg-brand-border rounded-full w-24 mx-auto mb-2" />
          <div className="h-3 bg-brand-border rounded-full w-20 mx-auto" />
        </div>
      </div>
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 space-y-4">
        <div className="h-5 bg-brand-border rounded-full w-32" />
        <div className="h-12 bg-brand-border rounded-xl" />
        <div className="h-12 bg-brand-border rounded-xl" />
        <div className="h-12 bg-brand-border rounded-full" />
      </div>
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-5 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-3 bg-brand-border rounded-full w-24" />
          <div className="h-8 bg-brand-border rounded-full w-16" />
        </div>
        <div className="w-7 h-7 bg-brand-border rounded-full" />
      </div>
    </div>
  )
}