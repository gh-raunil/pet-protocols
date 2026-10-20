export function ProfileSkeleton() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-surface-secondary rounded-xl" />
      <div className="h-32 bg-surface-secondary rounded-2xl border border-border-subtle" />
      <div className="h-48 bg-surface-secondary rounded-2xl border border-border-subtle" />
    </div>
  );
}

export function OrderCardSkeleton() {
  return (
    <div className="h-48 rounded-2xl bg-surface-primary border border-border-default shadow-xs animate-pulse p-4 space-y-3">
      <div className="flex justify-between items-center">
        <div className="h-4 w-28 bg-surface-secondary rounded-lg" />
        <div className="h-6 w-16 bg-surface-secondary rounded-full" />
      </div>
      <div className="h-10 bg-surface-secondary rounded-xl" />
      <div className="h-8 bg-surface-secondary rounded-xl mt-auto" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="h-28 rounded-2xl bg-surface-primary border border-border-default shadow-xs animate-pulse p-4 flex flex-col justify-between">
      <div className="flex justify-between items-center">
        <div className="h-3.5 w-24 bg-surface-secondary rounded-md" />
        <div className="w-8 h-8 rounded-xl bg-surface-secondary" />
      </div>
      <div className="h-7 w-28 bg-surface-secondary rounded-lg" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }) {
  return (
    <tr className="animate-pulse border-b border-border-subtle">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <div className="h-4 bg-surface-secondary rounded-md w-full" />
        </td>
      ))}
    </tr>
  );
}
