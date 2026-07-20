import { create } from 'zustand';
import { TodayQuestion, dailyQuestionApi } from '../lib/api';

/** today.state가 '할 일'(내 액션 대기) 상태인지 → 탭 뱃지·홈 유도용. */
function computeHasTodo(today: TodayQuestion | null): boolean {
  if (!today) return false;
  return today.state === 'NEEDS_CHOICE' || today.state === 'NEEDS_ANSWER';
}

type QuestionState = {
  today: TodayQuestion | null;
  loading: boolean;
  /** 내가 지금 해야 할 일(봉투 선택/답장)이 있는지. 탭바 코럴 점 표시용. */
  hasTodo: boolean;
  loadToday: () => Promise<void>;
  choose: (questionId: number) => Promise<void>;
  answer: (text: string) => Promise<void>;
  /** 봉인 대기 중인 지난 편지(date)에 답장 — 답하면 즉시 열림. */
  answerPending: (date: string, text: string) => Promise<void>;
  /** 오늘 열린 편지에 댓글 달기. 성공 시 today.comments에 낙관적 추가. */
  comment: (text: string) => Promise<void>;
  /** API 응답으로 today/hasTodo를 한 번에 갱신(choose/answer 결과 반영). */
  setFromResponse: (today: TodayQuestion) => void;
  reset: () => void;
};

export const useQuestionStore = create<QuestionState>((set, get) => ({
  today: null,
  loading: false,
  hasTodo: false,

  loadToday: async () => {
    set({ loading: true });
    try {
      const today = await dailyQuestionApi.today();
      get().setFromResponse(today);
    } catch {
      // 조용히 실패: 기존 today 유지(깜빡임 방지). 화면에서 today==null이면 에러 처리.
    } finally {
      set({ loading: false });
    }
  },

  choose: async (questionId) => {
    const today = await dailyQuestionApi.choose(questionId);
    get().setFromResponse(today);
  },

  answer: async (text) => {
    const today = await dailyQuestionApi.answer(text);
    get().setFromResponse(today);
  },

  answerPending: async (date, text) => {
    const today = await dailyQuestionApi.answerPending(date, text);
    get().setFromResponse(today);
  },

  comment: async (text) => {
    const added = await dailyQuestionApi.comment(text);
    const prev = get().today;
    if (prev) {
      set({ today: { ...prev, comments: [...(prev.comments ?? []), added] } });
    }
  },

  setFromResponse: (today) => set({ today, hasTodo: computeHasTodo(today) }),

  reset: () => set({ today: null, hasTodo: false, loading: false }),
}));
