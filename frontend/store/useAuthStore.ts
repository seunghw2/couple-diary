import { create } from 'zustand';
import { authApi, User } from '../lib/api';
import { tokenStore } from '../lib/tokenStore';

type AuthState = {
  status: 'unknown' | 'authenticated' | 'guest';
  user: User | null;
  bootstrap: () => Promise<void>;
  devLogin: (email: string, nickname: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,

  bootstrap: async () => {
    const token = await tokenStore.getToken();
    if (!token) {
      set({ status: 'guest', user: null });
      return;
    }
    try {
      const user = await authApi.me();
      set({ status: 'authenticated', user });
    } catch {
      await tokenStore.clear();
      set({ status: 'guest', user: null });
    }
  },

  devLogin: async (email, nickname) => {
    const res = await authApi.devLogin(email, nickname);
    await tokenStore.saveToken(res.accessToken);
    set({ status: 'authenticated', user: res.user });
  },

  logout: async () => {
    await tokenStore.clear();
    set({ status: 'guest', user: null });
  },

  setUser: (user) => set({ user }),
}));
