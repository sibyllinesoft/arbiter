import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@design-system";
import { type ReactNode } from "react";

export function AuthGate({ children }: { children: ReactNode }) {
  const { requireAuth, status, error, retry } = useAuth();

  if (!requireAuth) {
    return <>{children}</>;
  }

  if (status === "ready") {
    return <>{children}</>;
  }

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-graphite-950">
        <div className="bg-white dark:bg-graphite-900 rounded-lg shadow px-6 py-8 text-center max-w-md">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-graphite-25 mb-2">
            Checking authentication…
          </h1>
          <p className="text-sm text-gray-600 dark:text-graphite-400">
            Redirecting you to sign in if necessary.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-red-950/40">
      <div className="bg-white dark:bg-graphite-900 rounded-lg shadow px-6 py-8 text-center max-w-md space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
            Sign-in required
          </h1>
          <p className="text-sm text-gray-600 dark:text-graphite-300">
            {error ?? "You need to sign in to continue. Try again in a moment."}
          </p>
        </div>
        <Button variant="primary" onClick={retry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
