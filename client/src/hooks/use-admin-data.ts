import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";

interface FetchOptions<T> {
  queryKey: (string | number | undefined | null)[];
  endpoint: string;
  refetchInterval?: number;
  enabled?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: (data: T) => void;
  transform?: (data: unknown) => T;
  showErrorToast?: boolean;
  headers?: Record<string, string>;
  retry?: number;
}

export function useAdminFetch<T>({
  queryKey,
  endpoint,
  refetchInterval,
  enabled = true,
  onError,
  onSuccess,
  transform,
  showErrorToast = false,
  headers = {},
  retry = 2,
}: FetchOptions<T>) {
  const { toast } = useToast();
  
  return useQuery<T>({
    queryKey,
    queryFn: async ({ signal }) => {
      const res = await fetch(endpoint, { 
        credentials: "include",
        headers,
        signal,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const error = new Error(errorData.error || `Failed to fetch ${endpoint}`);
        if (showErrorToast) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
        throw error;
      }
      const data = await res.json();
      const result = transform ? transform(data) : data;
      onSuccess?.(result);
      return result;
    },
    refetchInterval,
    enabled,
    retry,
  });
}

interface MutationOptions<TData, TVariables> {
  endpoint: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  invalidateKeys?: (string | (string | number | undefined | null)[])[];
  successMessage?: string | ((data: TData) => string);
  errorMessage?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  headers?: Record<string, string>;
}

export function useAdminMutation<TData = unknown, TVariables = unknown>({
  endpoint,
  method = "POST",
  invalidateKeys = [],
  successMessage,
  errorMessage,
  showSuccessToast = false,
  showErrorToast = false,
  onSuccess,
  onError,
  headers = {},
}: MutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        credentials: "include",
        body: JSON.stringify(variables),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Request failed");
      }
      
      return res.json();
    },
    onSuccess: (data, variables) => {
      if (invalidateKeys.length > 0) {
        invalidateKeys.forEach((key) => {
          const queryKey = Array.isArray(key) ? key : [key];
          queryClient.invalidateQueries({ queryKey });
        });
      }
      
      if (showSuccessToast && successMessage) {
        const message = typeof successMessage === "function" 
          ? successMessage(data) 
          : successMessage;
        toast({ title: "Success", description: message });
      }
      
      onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      if (showErrorToast) {
        toast({
          title: "Error",
          description: errorMessage || error.message,
          variant: "destructive",
        });
      }
      onError?.(error, variables);
    },
  });
}

interface DynamicMutationOptions<TData> {
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  invalidateKeys?: string[];
  successMessage?: string | ((data: TData) => string);
  errorMessage?: string;
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

export function useAdminDynamicMutation<TData = unknown>({
  method = "POST",
  invalidateKeys = [],
  successMessage,
  errorMessage,
  onSuccess,
  onError,
}: DynamicMutationOptions<TData>) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation<TData, Error, { endpoint: string; body?: unknown }>({
    mutationFn: async ({ endpoint, body }) => {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Request failed");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      if (invalidateKeys.length > 0) {
        invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      }
      
      if (successMessage) {
        const message = typeof successMessage === "function" 
          ? successMessage(data) 
          : successMessage;
        toast({ title: "Success", description: message });
      }
      
      onSuccess?.(data);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: errorMessage || error.message,
        variant: "destructive",
      });
      onError?.(error);
    },
  });
}

interface AdminRole {
  role: string;
  requiredRoles: string[];
  isAuthorized: boolean;
}

export function useAdminAuth(requiredRoles: string[] = []): AdminRole {
  const defaultAdminRoles = [
    "LASHAN_SUPER_USER",
    "SUPER_ADMIN", 
    "SYSTEM_ADMIN",
    "ADMIN",
    "COMPLIANCE_MANAGER"
  ];
  
  const roles = requiredRoles.length > 0 ? requiredRoles : defaultAdminRoles;
  
  const { data: user } = useQuery({
    queryKey: ["/api/auth/get-session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/get-session", { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user;
    },
    staleTime: 30000,
  });
  
  const userRole = user?.role || "";
  const isAuthorized = roles.some(
    (r) => r.toLowerCase() === userRole.toLowerCase()
  );
  
  return {
    role: userRole,
    requiredRoles: roles,
    isAuthorized,
  };
}

export function useRefetchOnInterval(queryKey: string | string[], intervalMs: number = 30000) {
  const queryClient = useQueryClient();
  
  return () => {
    const key = Array.isArray(queryKey) ? queryKey : [queryKey];
    queryClient.invalidateQueries({ queryKey: key });
  };
}
