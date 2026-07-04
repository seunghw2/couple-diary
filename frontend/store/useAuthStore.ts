import { create } from 'zustand';
import { authApi, PartnerSummary, UserSummary } from '../lib/api';
import { tokenStore } from '../lib/tokenStore';

type AuthState = {
  status: 'unknown' | 'authenticated' | 'guest';
  user: UserSummary | null;
  coupled: boolean;
  partner: PartnerSummary | null;
  bootstrap: () => Promise<void>;
  devLogin: (nickname: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: UserSummary) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,
  coupled: false,
  partner: null,

  bootstrap: async () => {
    const token = await tokenStore.getToken();
    if (!token) {
      set({ status: 'guest', user: null, coupled: false, partner: null });
      return;
    }
    try {
      const me = await authApi.me();
      set({
        status: 'authenticated',
        user: me.user,
        coupled: me.coupled,
        partner: me.partner ?? null,
      });
    } catch {
      await tokenStore.clear();
      set({ status: 'guest', user: null, coupled: false, partner: null });
    }
  },

  devLogin: async (nickname) => {
    const res = await authApi.devLogin(nickname);
    await tokenStore.saveToken(res.accessToken);
    set({ status: 'authenticated', user: res.user });
    // 로그인 직후 커플 상태 동기화
    try {
      const me = await authApi.me();
      set({ user: me.user, coupled: me.coupled, partner: me.partner ?? null });
    } catch {
      /* 무시: 가드가 재조회 */
    }
  },

  logout: async () => {
    await tokenStore.clear();
    set({ status: 'guest', user: null, coupled: false, partner: null });
  },

  setUser: (user) => set({ user }),
}));
