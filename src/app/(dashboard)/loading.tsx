export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 w-64 bg-muted rounded" />
      <div className="h-4 w-48 bg-muted rounded" />
      <div className="grid gap-4 md:grid-cols-3 mt-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="h-64 bg-muted rounded-lg mt-6" />
    </div>
  );
}
