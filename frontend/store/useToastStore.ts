import { create } from 'zustand';

type ToastState = {
  message: string | null;
  /** 짧은 안내 토스트 표시(기본 1.6초 뒤 자동 사라짐). */
  show: (message: string, durationMs?: number) => void;
  hide: () => void;
};

let hideTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 전역 토스트 상태. lib/dialog.ts의 showToast가 구동하고,
 * 최상위(_layout)에 마운트된 <AppToast/>가 렌더한다. 저장 완료 등 가벼운 피드백용.
 */
export const useToastStore = create<ToastState>((set) => ({
  message: null,
  show: (message, durationMs = 1600) => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message });
    hideTimer = setTimeout(() => set({ message: null }), durationMs);
  },
  hide: () => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message: null });
  },
}));
