import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../domain/authStore";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, authenticated, configured } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-sm text-ink/45">
        A carregar…
      </div>
    );
  }

  if (configured && !authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
