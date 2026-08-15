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
 *  3) 보통은 openAuthSessionAsync 가 returnUri 이동을 감지해 result.url 을 돌려준다.
 *     ⚠️ 그런데 인가가 카카오톡 앱을 경유하면 마지막 리다이렉트가 인증 세션 밖(사파리)에서
 *     일어나, 세션은 dismiss 로 끝나고 토큰은 딥링크(today://auth?token=)로 앱에 직접 도착한다.
 *     이 경우를 놓치면 서버는 로그인에 성공했는데 앱은 "취소"로 알고 로그인 화면에 남는다.
 *     → 세션을 열기 "전"부터 딥링크를 구독해 두 경로 중 먼저 오는 쪽을 쓴다.
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

  // 딥링크 경로: 세션 밖(사파리/카카오톡 경유)으로 토큰이 도착하는 경우.
  // 세션을 열기 전에 구독해야 세션이 열려 있는 동안 도착한 링크도 놓치지 않는다.
  let linkResolve: (v: { kind: 'link'; url: string }) => void;
  const linkPromise = new Promise<{ kind: 'link'; url: string }>((res) => {
    linkResolve = res;
  });
  const sub = Linking.addEventListener('url', ({ url }) => {
    if (extractToken(url) || extractError(url)) linkResolve({ kind: 'link', url });
  });

  let resultUrl: string | null = null;
  try {
    const race = await Promise.race([
      WebBrowser.openAuthSessionAsync(authUrl, returnUri).then(
        (r) => ({ kind: 'session' as const, result: r }),
      ),
      linkPromise,
    ]);

    if (race.kind === 'link') {
      // 세션 밖으로 도착 — 아직 떠 있는 인증 창을 닫는다(안 닫으면 화면을 가린 채 남는다).
      try {
        WebBrowser.dismissAuthSession();
      } catch {
        /* 웹 등 미지원 플랫폼 무시 */
      }
      resultUrl = race.url;
    } else if (race.result.type === 'success' && race.result.url) {
      resultUrl = race.result.url;
    } else if (race.result.type === 'cancel') {
      return null; // 사용자가 직접 닫음
    } else {
      // dismiss 등: 카카오톡 경유 후 딥링크가 조금 늦게 도착하는 경우가 있어 잠깐 기다린다.
      const late = await Promise.race([
        linkPromise,
        new Promise<null>((res) => setTimeout(() => res(null), 4000)),
      ]);
      if (!late) return null; // 늦게라도 안 오면 취소로 간주(로그인 화면 유지)
      resultUrl = late.url;
    }
  } finally {
    sub.remove();
  }

  const error = extractError(resultUrl);
  if (error) {
    throw new Error('카카오 로그인에 실패했어요.');
  }
  const token = extractToken(resultUrl);
  if (!token) {
    throw new Error('로그인 응답이 올바르지 않아요.');
  }
  return token;
}

function extractToken(url: string | null): string | null {
  if (!url) return null;
  try {
    const { queryParams } = Linking.parse(url);
    const t = queryParams?.token;
    return typeof t === 'string' && t ? t : null;
  } catch {
    return null;
  }
}

function extractError(url: string | null): string | null {
  if (!url) return null;
  try {
    const { queryParams } = Linking.parse(url);
    const e = queryParams?.error;
    return typeof e === 'string' && e ? e : null;
  } catch {
    return null;
  }
}
