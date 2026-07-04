import { create } from 'zustand';
import { CoupleResponse, coupleApi } from '../lib/api';
import { useAuthStore } from './useAuthStore';

type CoupleState = {
  couple: CoupleResponse | null;
  loading: boolean;
  loaded: boolean;
  refresh: () => Promise<void>;
  invite: () => Promise<string>;
  connect: (inviteCode: string) => Promise<void>;
  setAnniversary: (date: string) => Promise<void>;
  reset: () => void;
};

export const useCoupleStore = create<CoupleState>((set) => ({
  couple: null,
  loading: false,
  loaded: false,

  refresh: async () => {
    // 연결 여부는 me().coupled 로 판단. 미연결이면 /couple 조회 생략.
    if (!useAuthStore.getState().coupled) {
      set({ couple: null, loaded: true, loading: false });
      return;
    }
    set({ loading: true });
    try {
      const couple = await coupleApi.get();
      set({ couple, loaded: true });
    } catch {
      set({ couple: null, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  invite: async () => {
    // 초대코드는 내 계정(UserSummary.inviteCode)에 이미 있음.
    const existing = useAuthStore.getState().user?.inviteCode;
    if (existing) return existing;
    const res = await coupleApi.invite();
    return res.inviteCode;
  },

  connect: async (inviteCode) => {
    const couple = await coupleApi.connect(inviteCode);
    set({ couple, loaded: true });
    // 연결 성공 → 인증 스토어의 coupled/partner 갱신
    await useAuthStore.getState().bootstrap();
  },

  setAnniversary: async (date) => {
    const couple = await coupleApi.setAnniversary(date);
    set({ couple, loaded: true });
  },

  reset: () => set({ couple: null, loaded: false }),
}));
