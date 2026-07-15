import { create } from 'zustand';
import { ApiException, authApi, PartnerSummary, pushApi, UserSummary } from '../lib/api';
import { loginWithApple } from '../lib/appleAuth';
import { loginWithKakao } from '../lib/kakaoAuth';
import { getExpoPushToken } from '../lib/push';
import { tokenStore } from '../lib/tokenStore';
// 순환참조지만 두 스토어 모두 useAuthStore를 런타임(함수 내부)에서만 쓰므로 안전.
import { useCoupleStore } from './useCoupleStore';
import { useNotifStore } from './useNotifStore';
import { useQuestionStore } from './useQuestionStore';

// 동시 bootstrap 중복 방지(커플연결 폴링·pull-to-refresh·resume가 겹쳐도 me() 한 번만).
let bootstrapInflight: Promise<void> | null = null;

type AuthState = {
  status: 'unknown' | 'authenticated' | 'guest';
  user: UserSummary | null;
  coupled: boolean;
  partner: PartnerSummary | null;
  bootstrap: () => Promise<void>;
  devLogin: (nickname: string) => Promise<void>;
  /** 카카오 웹 OAuth 로그인. 사용자가 취소하면 false, 로그인 성공 시 true. */
  kakaoLogin: () => Promise<boolean>;
  /** Apple 로그인(iOS 전용). 사용자가 취소하면 false, 로그인 성공 시 true. */
  appleLogin: () => Promise<boolean>;
  logout: () => Promise<void>;
  setUser: (user: UserSummary) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,
  coupled: false,
  partner: null,

  bootstrap: async () => {
    if (bootstrapInflight) return bootstrapInflight;
    bootstrapInflight = (async () => {
      const token = await tokenStore.getToken();
      if (!token) {
        set({ status: 'guest', user: null, coupled: false, partner: null });
        return;
      }
      try {
        const me = await authApi.me();
        set({
          status: 'authenticated',
          user: me.user,
          coupled: me.coupled,
          partner: me.partner ?? null,
        });
      } catch (e) {
        // 진짜 401(토큰 만료/무효)일 때만 토큰 삭제. 네트워크/5xx 같은 일시 오류엔
        // 유효한 토큰을 지우지 않아, 연결 불안정으로 로그아웃되는 것을 막는다.
        if (e instanceof ApiException && e.status === 401) {
          await tokenStore.clear();
        }
        set({ status: 'guest', user: null, coupled: false, partner: null });
      }
    })();
    try {
      await bootstrapInflight;
    } finally {
      bootstrapInflight = null;
    }
  },

  devLogin: async (nickname) => {
    const res = await authApi.devLogin(nickname);
    await tokenStore.saveToken(res.accessToken);
    set({ status: 'authenticated', user: res.user });
    // 로그인 직후 커플 상태 동기화
    try {
      const me = await authApi.me();
      set({ user: me.user, coupled: me.coupled, partner: me.partner ?? null });
    } catch {
      /* 무시: 가드가 재조회 */
    }
  },

  kakaoLogin: async () => {
    const token = await loginWithKakao();
    if (!token) return false; // 사용자 취소
    await tokenStore.saveToken(token);
    set({ status: 'authenticated' });
    // 로그인 직후 내 정보/커플 상태 동기화
    try {
      const me = await authApi.me();
      set({ user: me.user, coupled: me.coupled, partner: me.partner ?? null });
    } catch {
      /* 무시: 가드가 재조회 */
    }
    return true;
  },

  appleLogin: async () => {
    const cred = await loginWithApple();
    if (!cred) return false; // 사용자 취소
    const res = await authApi.appleLogin(cred.identityToken, cred.authorizationCode, cred.fullName);
    await tokenStore.saveToken(res.accessToken);
    set({ status: 'authenticated', user: res.user });
    // 로그인 직후 내 정보/커플 상태 동기화
    try {
      const me = await authApi.me();
      set({ user: me.user, coupled: me.coupled, partner: me.partner ?? null });
    } catch {
      /* 무시: 가드가 재조회 */
    }
    return true;
  },

  logout: async () => {
    // 이 기기 푸시 토큰 해제(로그아웃 후에도 옛 유저에게 알림 가는 것 방지). best-effort.
    try {
      const token = await getExpoPushToken();
      if (token) await pushApi.unregister(token);
    } catch {
      /* 무시 — 실패해도 로그아웃은 진행 */
    }
    await tokenStore.clear();
    set({ status: 'guest', user: null, coupled: false, partner: null });
    // 커플·알림 스토어도 즉시 초기화(가드 이펙트 타이밍에 의존하지 않게).
    useCoupleStore.getState().reset();
    useNotifStore.getState().reset();
    useQuestionStore.getState().reset();
  },

  setUser: (user) => set({ user }),
}));
