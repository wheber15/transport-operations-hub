export default function ReportsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-5" aria-busy="true">
      <div className="bg-muted h-8 w-72 animate-pulse rounded" />
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="bg-muted h-32 animate-pulse rounded-xl" key={index} />
        ))}
      </div>
      <div className="bg-muted h-96 animate-pulse rounded-xl" />
    </div>
  );
}
