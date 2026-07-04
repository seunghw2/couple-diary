import { create } from 'zustand';
import { Couple, coupleApi } from '../lib/api';

type CoupleState = {
  couple: Couple | null;
  loading: boolean;
  loaded: boolean;
  refresh: () => Promise<void>;
  invite: () => Promise<string>;
  connect: (inviteCode: string) => Promise<void>;
  setAnniversary: (date: string) => Promise<void>;
  reset: () => void;
};

export const useCoupleStore = create<CoupleState>((set, get) => ({
  couple: null,
  loading: false,
  loaded: false,

  refresh: async () => {
    set({ loading: true });
    try {
      const couple = await coupleApi.get();
      set({ couple, loaded: true });
    } catch {
      // 미연결/에러 → connected=false 로 취급
      set({ couple: { connected: false }, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  invite: async () => {
    // 이미 발급된 코드가 있으면 재사용
    const existing = get().couple?.inviteCode;
    if (existing) return existing;
    const res = await coupleApi.invite();
    set((s) => ({ couple: { ...(s.couple ?? { connected: false }), inviteCode: res.inviteCode } }));
    return res.inviteCode;
  },

  connect: async (inviteCode) => {
    const couple = await coupleApi.connect(inviteCode);
    set({ couple, loaded: true });
  },

  setAnniversary: async (date) => {
    const couple = await coupleApi.setAnniversary(date);
    set((s) => ({ couple: { ...(s.couple ?? { connected: true }), ...couple, anniversaryDate: date } }));
  },

  reset: () => set({ couple: null, loaded: false }),
}));
