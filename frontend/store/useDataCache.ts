import { create } from 'zustand';
import { DayDetail, MonthEntrySummary, entryApi } from '../lib/api';

/**
 * 앱 전반 stale-while-revalidate 캐시.
 *
 * 목적: 화면 이동(월 이동/상세 진입·복귀)마다 전체 로딩 스피너로 깜빡이는 문제 제거.
 * - 캐시 있으면 즉시 렌더(스피너 없음) + 백그라운드로 조용히 재조회해 갱신.
 * - 캐시 없을 때만 loading=true.
 * - 작성/수정/삭제/댓글 등 변경 후 관련 키를 무효화(invalidate)해 최신 반영.
 *
 * 저장 단위:
 *  - months[YYYY-MM] : 월별 캘린더 요약 (date→summary 맵)
 *  - details[YYYY-MM-DD] : 날짜별 상세
 */

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;
const monthKeyOfDate = (date: string) => date.slice(0, 7); // YYYY-MM

type MonthMap = Record<string, MonthEntrySummary>;

type CacheState = {
  months: Record<string, MonthMap>;
  details: Record<string, DayDetail>;
  /** 진행 중인 요청 dedup용(같은 키 중복 호출 방지). */
  inflight: Record<string, boolean>;

  /**
   * 월 요약 로드. 캐시 우선 + 백그라운드 갱신.
   * @returns 캐시된 값(있으면 즉시 사용 가능), 없으면 undefined.
   */
  getMonth: (year: number, month: number) => MonthMap | undefined;
  loadMonth: (year: number, month: number, opts?: { force?: boolean }) => Promise<MonthMap | null>;

  getDetail: (date: string) => DayDetail | undefined;
  loadDetail: (date: string, opts?: { force?: boolean }) => Promise<DayDetail | null>;
  setDetail: (date: string, detail: DayDetail) => void;

  /** 특정 날짜 변경 시 해당 detail + 그 달 month 무효화. */
  invalidateDate: (date: string) => void;
  invalidateMonth: (year: number, month: number) => void;
  reset: () => void;
};

export const useDataCache = create<CacheState>((set, get) => ({
  months: {},
  details: {},
  inflight: {},

  getMonth: (year, month) => get().months[monthKey(year, month)],

  loadMonth: async (year, month, opts) => {
    const key = monthKey(year, month);
    const cached = get().months[key];
    if (cached && !opts?.force) {
      // 캐시 반환 후 백그라운드 갱신(중복 방지).
      if (!get().inflight[`m:${key}`]) void get().loadMonth(year, month, { force: true });
      return cached;
    }
    if (get().inflight[`m:${key}`]) return cached ?? null;
    set((s) => ({ inflight: { ...s.inflight, [`m:${key}`]: true } }));
    try {
      const list = await entryApi.month(year, month);
      const map: MonthMap = {};
      for (const e of list) map[e.date] = e;
      set((s) => ({ months: { ...s.months, [key]: map } }));
      return map;
    } catch {
      return cached ?? null;
    } finally {
      set((s) => {
        const inflight = { ...s.inflight };
        delete inflight[`m:${key}`];
        return { inflight };
      });
    }
  },

  getDetail: (date) => get().details[date],

  loadDetail: async (date, opts) => {
    const cached = get().details[date];
    if (cached && !opts?.force) {
      if (!get().inflight[`d:${date}`]) void get().loadDetail(date, { force: true });
      return cached;
    }
    if (get().inflight[`d:${date}`]) return cached ?? null;
    set((s) => ({ inflight: { ...s.inflight, [`d:${date}`]: true } }));
    try {
      const d = await entryApi.detail(date);
      set((s) => ({ details: { ...s.details, [date]: d } }));
      return d;
    } catch {
      // 404 등 = 아직 아무도 안 쓴 날. 캐시에 안 남기고 null.
      return cached ?? null;
    } finally {
      set((s) => {
        const inflight = { ...s.inflight };
        delete inflight[`d:${date}`];
        return { inflight };
      });
    }
  },

  setDetail: (date, detail) => set((s) => ({ details: { ...s.details, [date]: detail } })),

  invalidateDate: (date) => {
    const mk = monthKeyOfDate(date);
    set((s) => {
      const details = { ...s.details };
      delete details[date];
      const months = { ...s.months };
      delete months[mk];
      return { details, months };
    });
  },

  invalidateMonth: (year, month) => {
    const key = monthKey(year, month);
    set((s) => {
      const months = { ...s.months };
      delete months[key];
      return { months };
    });
  },

  reset: () => set({ months: {}, details: {}, inflight: {} }),
}));

/** 알림 무효화: notif 스토어를 조용히 재조회(순환 import 회피용 지연 로드). */
export function invalidateNotifications() {
  // 지연 require로 순환 의존 방지.
  import('./useNotifStore').then(({ useNotifStore }) => {
    void useNotifStore.getState().fetch();
  });
}

/** 날짜 변경 후 캐시 무효화 + 알림 무효화 묶음 헬퍼. */
export function invalidateAfterMutation(date: string) {
  useDataCache.getState().invalidateDate(date);
  invalidateNotifications();
}
