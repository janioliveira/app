import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";

import { useSession } from "@/hooks/useSession";
import type { Role } from "@/lib/types";

interface ProtectedRouteProps {
  roles: Role[];
  children: React.ReactNode;
}

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { user, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        className="grid min-h-[60vh] place-items-center"
        data-testid="protected-route-loading"
      >
        <Loader2 className="text-primary size-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={user.role === "cliente" ? "/cliente" : "/admin"} replace />;
  }

  return <>{children}</>;
}
