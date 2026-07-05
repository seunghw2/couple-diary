import { useAlertStore } from '../store/useAlertStore';

/**
 * 확인/취소 다이얼로그. 앱 톤 커스텀 알림(useAlertStore + <AppAlert/>)으로 표시.
 * 이전엔 네이티브 Alert(회색)이었으나 앱 디자인에 맞춰 교체.
 */
export function confirmAsync(
  title: string,
  message: string,
  confirmLabel = '확인',
  destructive = false
): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const once = (v: boolean) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    useAlertStore.getState().open({
      title,
      message,
      buttons: [
        { text: '취소', style: 'cancel', onPress: () => once(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => once(true) },
      ],
    });
  });
}

/** 단순 알림. 확인 버튼 하나. */
export function showAlert(title: string, message?: string, onOk?: () => void) {
  useAlertStore.getState().open({
    title,
    message,
    buttons: [{ text: '확인', style: 'default', onPress: onOk }],
  });
}
