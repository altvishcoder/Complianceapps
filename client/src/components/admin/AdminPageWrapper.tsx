import { Loader2, Lock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";

interface AdminPageWrapperProps {
  children: React.ReactNode;
  title: string;
  requiredRoles?: string[];
  isLoading?: boolean;
  error?: Error | null;
  customLoadingComponent?: React.ReactNode;
  fullScreen?: boolean;
  skipAuthCheck?: boolean;
}

const DEFAULT_ADMIN_ROLES = [
  "LASHAN_SUPER_USER",
  "SUPER_ADMIN",
  "SYSTEM_ADMIN", 
  "ADMIN",
  "COMPLIANCE_MANAGER"
];

export function AdminPageWrapper({
  children,
  title,
  requiredRoles = DEFAULT_ADMIN_ROLES,
  isLoading = false,
  error = null,
  customLoadingComponent,
  fullScreen = true,
  skipAuthCheck = false,
}: AdminPageWrapperProps) {
  const { user, isLoading: authLoading } = useAuth();

  const containerClass = fullScreen 
    ? "flex h-screen bg-muted/30 items-center justify-center"
    : "flex h-64 items-center justify-center";

  if (!skipAuthCheck) {
    if (authLoading) {
      return (
        <div className={containerClass} data-testid="admin-loading">
          {customLoadingComponent || (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          )}
        </div>
      );
    }

    if (!user) {
      return (
        <div className={containerClass} data-testid="admin-not-authenticated">
          <div className="text-center">
            <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Please log in to access this page</p>
          </div>
        </div>
      );
    }

    const userRole = user.role || "";
    const isAuthorized = requiredRoles.some(
      (role) => role.toLowerCase() === userRole.toLowerCase()
    );

    if (!isAuthorized) {
      return (
        <div className={containerClass} data-testid="admin-unauthorized">
          <div className="text-center max-w-md">
            <Lock className="h-8 w-8 text-destructive mx-auto mb-2" />
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You don't have permission to access {title}. 
              Contact your administrator if you believe this is an error.
            </p>
          </div>
        </div>
      );
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center" data-testid="admin-data-loading">
        {customLoadingComponent || (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6" data-testid="admin-error">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error.message || `Failed to load ${title}`}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}

interface DataLoadingStateProps {
  isLoading: boolean;
  error?: Error | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}

export function DataLoadingState({
  isLoading,
  error,
  isEmpty = false,
  emptyMessage = "No data found",
  children,
}: DataLoadingStateProps) {
  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center" data-testid="data-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" data-testid="data-error">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground" data-testid="data-empty">
        {emptyMessage}
      </div>
    );
  }

  return <>{children}</>;
}
