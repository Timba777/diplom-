import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { isAuthenticated } from "@/lib/api";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated() || !user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
