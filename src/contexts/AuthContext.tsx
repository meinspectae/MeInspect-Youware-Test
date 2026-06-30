import React, { createContext, useContext, useEffect } from 'react';
import { client } from '../api/client';
import { useAuthStore } from '../store/authStore';

interface AuthContextType {
  user: { id: string; email: string; name: string } | null;
  loading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isChecking, setUser, setChecking, reset } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    // Skip network request if user exists locally
    if (useAuthStore.getState().user) {
      setChecking(false);
      return;
    }
    try {
      const session = await client.auth.getSession();
      if (session.data?.user) {
        localStorage.setItem('meinspect_token', 'platform-auth');
        setUser({
          id: session.data.user.id,
          email: session.data.user.email || '',
          name: session.data.user.name || '',
        });
      } else {
        setChecking(false);
      }
    } catch {
      setChecking(false);
    }
  }

  async function logout() {
    await client.auth.signOut();
    reset();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: isChecking,
        isAuthenticated: !!user,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
