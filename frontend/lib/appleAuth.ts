import * as AppleAuthentication from 'expo-apple-authentication';

export type AppleCredential = {
  identityToken: string;
  /** Apple은 최초 로그인 1회에만 이름을 준다. 이후엔 null. */
  fullName: string | null;
};

/**
 * Apple 로그인 시트를 띄우고 identityToken을 받아온다.
 * 사용자가 취소하면 null(ERR_REQUEST_CANCELED). identityToken이 없으면 예외.
 */
export async function loginWithApple(): Promise<AppleCredential | null> {
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!cred.identityToken) {
      throw new Error('Apple 로그인 토큰을 받지 못했어요.');
    }
    const name = cred.fullName;
    const fullName = name
      ? [name.familyName, name.givenName].filter(Boolean).join('').trim() || null
      : null;
    return { identityToken: cred.identityToken, fullName };
  } catch (e) {
    // 사용자가 시트를 닫은 경우는 오류가 아니라 취소로 처리.
    if (e && typeof e === 'object' && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') {
      return null;
    }
    throw e;
  }
}
