export default function DashboardLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50" dir="rtl">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
        <p className="text-sm text-gray-500">טוען דשבורד...</p>
      </div>
    </main>
  );
}
