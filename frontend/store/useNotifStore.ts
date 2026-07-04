import { create } from 'zustand';
import { ApiException, Notification, notificationApi } from '../lib/api';
import { useAuthStore } from './useAuthStore';
import { invalidateNotifications } from './useDataCache';

type PokeResult = { ok: true } | { ok: false; reason: 'not-connected' | 'error' };

type NotifState = {
  items: Notification[];
  unreadCount: number;
  loading: boolean;
  /** 알림 목록 재조회. 커플 연결된 경우에만 실제 호출. */
  fetch: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  poke: () => Promise<PokeResult>;
  reset: () => void;
};

export const useNotifStore = create<NotifState>((set, get) => ({
  items: [],
  unreadCount: 0,
  loading: false,

  fetch: async () => {
    // 커플 연결된 경우만 조회.
    if (!useAuthStore.getState().coupled) {
      set({ items: [], unreadCount: 0, loading: false });
      return;
    }
    // 캐시(이미 목록 있음)면 스피너 없이 조용히 갱신, 첫 로드만 loading.
    set({ loading: get().items.length === 0 });
    try {
      const res = await notificationApi.list();
      set({ items: res.items, unreadCount: res.unreadCount, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  markRead: async (id) => {
    // 낙관적 업데이트: 즉시 읽음 처리.
    const before = get().items.find((n) => n.id === id);
    if (before && !before.read) {
      set((s) => ({
        items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    }
    try {
      await notificationApi.read(id);
    } catch {
      // 실패해도 다음 fetch에서 정정됨.
    }
  },

  markAllRead: async () => {
    set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })), unreadCount: 0 }));
    try {
      await notificationApi.readAll();
    } catch {
      /* 다음 fetch에서 정정 */
    }
  },

  poke: async () => {
    if (!useAuthStore.getState().coupled) return { ok: false, reason: 'not-connected' };
    try {
      await notificationApi.poke();
      // 상대에게 간 알림이 내 목록엔 영향 없지만 무효화해 최신화.
      invalidateNotifications();
      return { ok: true };
    } catch (e) {
      if (e instanceof ApiException && e.status === 400) return { ok: false, reason: 'not-connected' };
      return { ok: false, reason: 'error' };
    }
  },

  reset: () => set({ items: [], unreadCount: 0, loading: false }),
}));
