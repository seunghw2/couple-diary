import { create } from 'zustand';

/** 앱 톤 커스텀 알림의 버튼 정의(RN Alert.alert 버튼과 유사). */
export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type AlertConfig = {
  title: string;
  message?: string;
  buttons: AlertButton[];
};

type AlertState = {
  visible: boolean;
  config: AlertConfig | null;
  open: (config: AlertConfig) => void;
  close: () => void;
};

/**
 * 전역 커스텀 알림 상태. lib/dialog.ts의 showAlert/confirmAsync가 이 스토어를 구동하고,
 * 최상위(_layout)에 마운트된 <AppAlert/>가 렌더한다. iOS 기본 회색 팝업 대신 앱 톤 팝업 사용.
 */
export const useAlertStore = create<AlertState>((set) => ({
  visible: false,
  config: null,
  open: (config) => set({ visible: true, config }),
  close: () => set({ visible: false }),
}));
