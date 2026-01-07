import { useEffect, useState, ComponentType } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

const ADMIN_ROLES = [
  "LASHAN_SUPER_USER",
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "ADMIN",
  "COMPLIANCE_MANAGER"
];

export function AdminProtectedRoute({ component: Component }: { component: ComponentType }) {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  const userRole = user?.role?.toUpperCase() || "";
  const isAdmin = ADMIN_ROLES.some(role => role.toUpperCase() === userRole);

  useEffect(() => {
    if (!isLoading && !redirecting) {
      if (!isAuthenticated) {
        setRedirecting(true);
        setLocation("/admin/login");
      } else if (!isAdmin) {
        setRedirecting(true);
        setLocation("/admin/login?error=" + encodeURIComponent("Access denied. Admin privileges required."));
      }
    }
  }, [isAuthenticated, isLoading, isAdmin, setLocation, redirecting]);

  if (isLoading || redirecting) {
    return (
      <div className="flex h-screen bg-muted/30">
        <div className="w-64 bg-card border-r p-4 space-y-4">
          <Skeleton className="h-8 w-32" />
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return <Component />;
}
