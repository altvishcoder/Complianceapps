import { QueryClient, QueryFunction } from "@tanstack/react-query";

export interface RFC7807Error {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Array<{ path: string; message: string }>;
  traceId?: string;
  timestamp?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly problemDetail?: RFC7807Error;

  constructor(status: number, message: string, problemDetail?: RFC7807Error) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.problemDetail = problemDetail;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let problemDetail: RFC7807Error | undefined;
    let message = res.statusText;
    
    try {
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        problemDetail = await res.json();
        message = problemDetail?.detail || problemDetail?.title || message;
      } else {
        message = await res.text() || message;
      }
    } catch {
      message = res.statusText;
    }
    
    throw new ApiError(res.status, `${res.status}: ${message}`, problemDetail);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true, // Refetch when user returns to tab (SWR behavior)
      staleTime: 30 * 1000, // Data is fresh for 30 seconds, then stale but usable
      gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
      retry: 1, // One retry on failure
      retryDelay: 1000, // 1 second delay before retry
    },
    mutations: {
      retry: false,
    },
  },
});
