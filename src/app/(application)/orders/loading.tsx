export default function OrdersLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:gap-8">
      <div className="bg-muted h-24 animate-pulse rounded-xl" />
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <div className="bg-muted h-16 animate-pulse" />
        <div className="space-y-3 p-4">
          <div className="bg-muted h-10 animate-pulse rounded" />
          <div className="bg-muted h-10 animate-pulse rounded" />
          <div className="bg-muted h-10 animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}
