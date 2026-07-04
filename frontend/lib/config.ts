import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * 백엔드 API 베이스 URL.
 * 우선순위: EXPO_PUBLIC_API_URL > app.json extra.apiUrl > 플랫폼별 기본값.
 *
 * - iOS 시뮬레이터/웹: localhost
 * - Android 에뮬레이터: 10.0.2.2
 * - 실제 폰(Expo Go): Mac LAN IP (Expo hostUri에서 추출)
 */
function resolveApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;

  const extraUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

  // 실제 폰이면 localhost로는 백엔드에 못 붙으니 hostUri IP 우선.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:8083`;
  }

  if (Platform.OS === 'android' && !host) return 'http://10.0.2.2:8083';

  return extraUrl ?? 'http://localhost:8083';
}

export const API_URL = resolveApiUrl();
