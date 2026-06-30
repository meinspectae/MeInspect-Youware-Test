import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
}

interface AuthState {
  user: AuthUser | null;
  isChecking: boolean;
  setUser: (user: AuthUser | null) => void;
  setChecking: (value: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isChecking: true,
      setUser: (user) => set({ user, isChecking: false }),
      setChecking: (value) => set({ isChecking: value }),
      reset: () => set({ user: null, isChecking: false }),
    }),
    {
      name: 'meinspect-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
