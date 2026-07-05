import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { KAKAO_REDIRECT_URI, KAKAO_REST_KEY } from './config';

/**
 * 카카오 웹 OAuth (Expo Go 호환).
 *
 * 플로우(서버 콜백 방식):
 *  1) 앱이 returnUri = Linking.createURL('auth') 를 만들고, 그것을 state로 실어
 *     카카오 인가 페이지를 WebBrowser.openAuthSessionAsync 로 연다.
 *     redirect_uri 는 백엔드 콜백(KAKAO_REDIRECT_URI, HTTPS) — 카카오는 커스텀 스킴을 허용하지 않는다.
 *  2) 카카오 → 백엔드 콜백(code, state=returnUri) → 백엔드가 code 교환·로그인 처리 후
 *     returnUri?token=JWT 로 302 리다이렉트한다.
 *  3) openAuthSessionAsync 가 returnUri 로의 이동을 감지해 result.url 을 돌려주고,
 *     여기서 token 을 파싱한다.
 *
 * 반환: 우리 백엔드가 발급한 access token(JWT). 취소 시 null.
 */
export async function loginWithKakao(): Promise<string | null> {
  if (!KAKAO_REST_KEY) {
    throw new Error('카카오 키가 설정되지 않았어요.');
  }

  // Expo Go: exp://<host>/--/auth · 스탠드얼론: today://auth
  const returnUri = Linking.createURL('auth');

  const authUrl =
    'https://kauth.kakao.com/oauth/authorize' +
    `?client_id=${encodeURIComponent(KAKAO_REST_KEY)}` +
    `&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}` +
    '&response_type=code' +
    `&state=${encodeURIComponent(returnUri)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUri);

  if (result.type !== 'success' || !result.url) {
    // cancel / dismiss
    return null;
  }

  const { queryParams } = Linking.parse(result.url);
  const error = queryParams?.error;
  if (error) {
    throw new Error('카카오 로그인에 실패했어요.');
  }
  const token = queryParams?.token;
  if (typeof token !== 'string' || !token) {
    throw new Error('로그인 응답이 올바르지 않아요.');
  }
  return token;
}
