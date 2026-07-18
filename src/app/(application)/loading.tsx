export default function ApplicationLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:gap-8">
      <div className="bg-muted h-32 animate-pulse rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-muted h-32 animate-pulse rounded-xl" />
        <div className="bg-muted h-32 animate-pulse rounded-xl" />
        <div className="bg-muted h-32 animate-pulse rounded-xl" />
        <div className="bg-muted h-32 animate-pulse rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-muted h-72 animate-pulse rounded-xl" />
        <div className="bg-muted h-72 animate-pulse rounded-xl" />
      </div>
    </div>
  );
}
