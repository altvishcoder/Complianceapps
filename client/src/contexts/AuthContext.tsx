import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { authClient } from '@/lib/auth-client';

interface User {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  role: string;
  organisationId: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const session = await authClient.getSession();
      
      if (session?.data?.user) {
        const u = session.data.user as {
          id: string;
          email: string;
          name: string | null;
          username?: string;
          role?: string;
          organisationId?: string;
        };
        setUser({
          id: u.id,
          username: u.username || u.email,
          name: u.name,
          email: u.email,
          role: u.role || 'VIEWER',
          organisationId: u.organisationId || 'default-org',
        });
      } else {
        // Safari ITP fallback: Check sessionStorage backup if cookies failed
        try {
          const backup = sessionStorage.getItem('auth_session_backup');
          if (backup) {
            const { user: backupUser, timestamp } = JSON.parse(backup);
            // Only use backup if less than 5 minutes old (for immediate post-login)
            if (Date.now() - timestamp < 5 * 60 * 1000 && backupUser) {
              setUser({
                id: backupUser.id,
                username: backupUser.username || backupUser.email,
                name: backupUser.name,
                email: backupUser.email,
                role: backupUser.role || 'VIEWER',
                organisationId: backupUser.organisationId || 'default-org',
              });
              return;
            }
          }
        } catch {
          // Ignore storage errors
        }
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        return { success: false, error: result.error.message || 'Login failed' };
      }

      // Safari ITP fix: Store session data in sessionStorage as backup
      // This helps when cookies are blocked by browser privacy settings
      if (result.data?.user) {
        try {
          sessionStorage.setItem('auth_session_backup', JSON.stringify({
            user: result.data.user,
            token: result.data.token,
            timestamp: Date.now()
          }));
        } catch {
          // Ignore storage errors
        }
      }

      await refreshUser();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await authClient.signOut();
      // Clear Safari backup session on logout
      try {
        sessionStorage.removeItem('auth_session_backup');
      } catch {
        // Ignore storage errors
      }
    } finally {
      setUser(null);
      setLocation('/login');
    }
  }, [setLocation]);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
