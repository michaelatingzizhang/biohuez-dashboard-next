import Link from "next/link";
import { BarChart3 } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-6 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <BarChart3 className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-4xl font-bold mb-3">Page not found</h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        This section is not available yet. Head back to the dashboard.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
