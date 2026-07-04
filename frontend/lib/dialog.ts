import { Alert, Platform } from 'react-native';

/** 확인/취소 다이얼로그. 웹은 window.confirm, 네이티브는 Alert. */
export function confirmAsync(
  title: string,
  message: string,
  confirmLabel = '확인',
  destructive = false
): Promise<boolean> {
  if (Platform.OS === 'web') {
    const fn = (globalThis as { confirm?: (msg: string) => boolean }).confirm;
    return Promise.resolve(fn ? fn(`${title}\n${message}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: '취소', style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

/** 단순 알림. 웹은 window.alert, 네이티브는 Alert. */
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    const fn = (globalThis as { alert?: (msg: string) => void }).alert;
    fn?.(message ? `${title}\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
