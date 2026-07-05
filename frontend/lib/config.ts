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

/**
 * Kakao Maps JavaScript 키. 지도 탭(WebView + Kakao Maps JS SDK)에서 사용.
 * 우선순위: EXPO_PUBLIC_KAKAO_JS_KEY 환경변수 > app.json extra.kakaoJsKey.
 *
 * 키 발급: https://developers.kakao.com → 내 애플리케이션 → 앱 키 → "JavaScript 키".
 * (지도가 뜨려면 카카오 콘솔의 "플랫폼 > Web"에 서비스 도메인 등록도 필요.)
 * 키가 비어 있으면 지도 대신 "키 필요" 안내 화면이 표시된다.
 */
function resolveKakaoJsKey(): string {
  const envKey = process.env.EXPO_PUBLIC_KAKAO_JS_KEY;
  if (envKey) return envKey;
  const extraKey = (Constants.expoConfig?.extra as { kakaoJsKey?: string } | undefined)?.kakaoJsKey;
  return extraKey ?? '';
}

export const KAKAO_JS_KEY = resolveKakaoJsKey();
