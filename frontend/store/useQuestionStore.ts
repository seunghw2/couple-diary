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
  /** 상대 답장 하트 토글. add=true면 하트 추가, false면 해제. */
  react: (answerId: number) => Promise<void>;
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

  react: async (answerId) => {
    const prev = get().today;
    // 낙관적 업데이트: 상대 답의 reactedByMe를 즉시 토글(백엔드도 단일 토글).
    if (prev?.partnerAnswer && prev.partnerAnswer.id === answerId) {
      set({
        today: {
          ...prev,
          partnerAnswer: { ...prev.partnerAnswer, reactedByMe: !prev.partnerAnswer.reactedByMe },
        },
      });
    }
    try {
      await dailyQuestionApi.react(answerId);
    } catch {
      // 실패 시 원복.
      if (prev) set({ today: prev });
      throw new Error('react-failed');
    }
  },

  setFromResponse: (today) => set({ today, hasTodo: computeHasTodo(today) }),

  reset: () => set({ today: null, hasTodo: false, loading: false }),
}));
