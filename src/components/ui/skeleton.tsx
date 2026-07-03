// ═══════════════════════════════════════════════════════════════════════
// Reusable skeleton loading components
// ═══════════════════════════════════════════════════════════════════════

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-neutral-200/70 rounded-lg ${className}`} />
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-4 h-4 rounded" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-full" />
    </div>
  )
}

export function BrandCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
      <Skeleton className="w-full h-28 rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-full" />
        <div className="flex gap-1.5 mt-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function DocRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton className="w-6 h-6 rounded" />
      <div className="flex-1 min-w-0 space-y-1">
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-2.5 w-2/5" />
      </div>
      <Skeleton className="h-3 w-12 shrink-0" />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F6F7F9' }}>
      <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-10 py-6 md:py-8 space-y-6">
        {/* Welcome skeleton */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-neutral-100 space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
          <div className="pt-6 border-t border-neutral-100">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-80 mt-2" />
            <Skeleton className="h-11 w-full mt-4" />
          </div>
        </div>
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <CardSkeleton key={i} />)}
        </div>
        {/* Brand cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <BrandCardSkeleton key={i} />)}
        </div>
        {/* Recent + Quick access */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-white rounded-2xl p-5 border border-neutral-100 shadow-sm space-y-3">
            <Skeleton className="h-5 w-24" />
            {[1,2,3,4].map(i => <DocRowSkeleton key={i} />)}
          </div>
          <div className="bg-white rounded-2xl p-5 border border-neutral-100 shadow-sm space-y-3">
            <Skeleton className="h-5 w-24" />
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </div>
      </div>
    </div>
  )
}

export function DocListSkeleton() {
  return (
    <div className="flex-1 flex overflow-hidden bg-[#F8F9FA]">
      {/* Sidebar skeleton */}
      <div className="w-[260px] shrink-0 bg-white border-r border-neutral-200 p-4 space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-full rounded-lg" />
        <div className="space-y-1 pt-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5">
              <Skeleton className="w-3.5 h-3.5 rounded" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </div>
      {/* Main area skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-3 bg-white border-b border-neutral-100 space-y-2">
          <Skeleton className="h-3.5 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg ml-auto" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-0">
          {[1,2,3,4,5,6,7,8].map(i => <DocRowSkeleton key={i} />)}
        </div>
      </div>
      {/* Detail panel skeleton */}
      <div className="w-[300px] shrink-0 bg-white border-l border-neutral-200 p-4 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-4 w-20" />
        <div className="grid gap-y-2 gap-x-2" style={{ gridTemplateColumns: '70px 1fr' }}>
          {[1,2,3,4,5,6].map(i => (
            <>
              <Skeleton key={`l${i}`} className="h-3 w-14" />
              <Skeleton key={`v${i}`} className="h-3 w-full" />
            </>
          ))}
        </div>
        <Skeleton className="h-4 w-20 mt-4" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  )
}
