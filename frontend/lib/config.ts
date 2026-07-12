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

/**
 * Kakao REST API 키. 카카오 로그인 인가 URL의 client_id로 사용(공개 값 — OAuth 리다이렉트에 노출됨).
 * 실제 토큰 교환은 백엔드가 하므로 이 키로 비밀 요청을 보내지 않는다.
 * 우선순위: EXPO_PUBLIC_KAKAO_REST_KEY > app.json extra.kakaoRestKey.
 */
function resolveKakaoRestKey(): string {
  const envKey = process.env.EXPO_PUBLIC_KAKAO_REST_KEY;
  if (envKey) return envKey;
  const extraKey = (Constants.expoConfig?.extra as { kakaoRestKey?: string } | undefined)?.kakaoRestKey;
  return extraKey ?? '';
}

export const KAKAO_REST_KEY = resolveKakaoRestKey();

/**
 * 백엔드 카카오 콜백(= 카카오 콘솔에 등록하는 Redirect URI).
 * 카카오는 커스텀 스킴(exp://, today://)을 Redirect URI로 허용하지 않으므로
 * 반드시 백엔드 HTTPS 콜백을 redirect_uri로 쓴다. 콜백이 로그인 처리 후 앱 returnUri로 302 리다이렉트한다.
 *
 * ⚠️ 이 값은 카카오 콘솔에 등록한 값과 **글자 하나까지 동일**해야 하고, 토큰 교환 때도 같은 값이어야 한다.
 * 그래서 API_URL(실기기에선 LAN IP로 바뀜)로 조립하지 않고 **고정 HTTPS 도메인**을 쓴다.
 * 우선순위: EXPO_PUBLIC_KAKAO_REDIRECT_URI > app.json extra.kakaoRedirectUri > 운영 기본값.
 */
function resolveKakaoRedirectUri(): string {
  const envUri = process.env.EXPO_PUBLIC_KAKAO_REDIRECT_URI;
  if (envUri) return envUri;
  const extraUri = (Constants.expoConfig?.extra as { kakaoRedirectUri?: string } | undefined)
    ?.kakaoRedirectUri;
  return extraUri ?? 'https://lovetoday.terrylovesapp.uk/api/auth/kakao/callback';
}

export const KAKAO_REDIRECT_URI = resolveKakaoRedirectUri();
