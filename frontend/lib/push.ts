import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * 원격 푸시 알림(앱이 꺼져 있어도 도착).
 * - 실제 기기 + EAS 빌드에서만 동작(Expo Go/시뮬레이터/웹은 발급 불가 → null).
 * - 서버(PushSender)가 이 토큰으로 Expo Push API에 발송한다.
 */

// 앱이 포그라운드일 때도 배너/목록/소리로 알림을 노출.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
}

/**
 * 알림 권한을 요청하고 Expo 푸시 토큰을 발급받는다.
 * 권한 거부/미지원 환경이면 null(앱 흐름엔 영향 없음).
 */
export async function getExpoPushToken(): Promise<string | null> {
  // 웹/시뮬레이터는 원격 푸시 토큰 발급 불가.
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  // Android는 채널이 있어야 헤드업 알림이 뜬다.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '기본 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  if (!granted) return null;

  try {
    const projectId = getProjectId();
    const res = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return res.data;
  } catch {
    return null;
  }
}
