import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/**
 * 앱 컬러(주요 강조색) 로컬 저장 스토어.
 * - appPrimary: 앱 전체 기본 강조색(기본=코럴 #FF8E72). 내 기기에만 저장(AsyncStorage), 서버 X.
 * - 프로필 컬러(avatarColor)와는 별개: 앱 컬러는 "나만 보는 앱 테마"다.
 */

const STORAGE_KEY = 'app.primaryColor';

type ThemeState = {
  appPrimary: string;
  loaded: boolean;
  /** 앱 컬러 변경 + 로컬 영속. */
  setAppPrimary: (hex: string) => void;
  /** 앱 시작 시 저장된 값 복원. */
  hydrate: () => Promise<void>;
};

export const useThemeStore = create<ThemeState>((set) => ({
  appPrimary: '#FF8E72', // 기본 코럴 (순환참조 방지 위해 리터럴)
  loaded: false,

  setAppPrimary: (hex) => {
    set({ appPrimary: hex });
    void AsyncStorage.setItem(STORAGE_KEY, hex);
  },

  hydrate: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) set({ appPrimary: saved, loaded: true });
      else set({ loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
}));
