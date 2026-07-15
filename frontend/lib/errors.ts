import { ApiException } from './api';

/**
 * 사용자에게 보여줄 에러 문구를 뽑는다.
 * 우선순위: 백엔드가 준 message → status별 기본 문구 → fallback.
 * (api.ts가 오프라인/타임아웃을 status 0으로 래핑하므로 네트워크 오류도 구분됨)
 */
export function errorMessage(e: unknown, fallback = '잠시 후 다시 시도해 주세요.'): string {
  if (e instanceof ApiException) {
    if (e.body?.message) return e.body.message;
    switch (e.status) {
      case 0:
        return '인터넷 연결을 확인해 주세요.';
      case 403:
        return '접근 권한이 없어요.';
      case 409:
        return '이미 처리된 요청이에요.';
      case 413:
        return '용량이 너무 커요.';
      case 429:
        return '조금 뒤에 다시 시도해 주세요.';
      case 500:
      case 502:
      case 503:
        return '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
    }
  }
  return fallback;
}

/** 오프라인/타임아웃(네트워크) 오류인지. 빈 상태 vs 오류 구분에 사용. */
export function isNetworkError(e: unknown): boolean {
  return e instanceof ApiException && e.status === 0;
}
