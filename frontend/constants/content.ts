/** 정적 콘텐츠: 기분 이모지, 템플릿 프롬프트. */

export const MOODS = ['😆', '🥰', '🙂', '😌', '😢', '😴'] as const;

/** 템플릿 모드 빈칸(promptKey → 라벨). */
export const TEMPLATE_PROMPTS: { promptKey: string; emoji: string; label: string; placeholder: string }[] = [
  { promptKey: 'where', emoji: '📍', label: '오늘 어디서 뭐 했어?', placeholder: '오늘의 데이트를 적어봐...' },
  { promptKey: 'best', emoji: '💛', label: '오늘 제일 좋았던 순간은?', placeholder: '가장 좋았던 순간...' },
  { promptKey: 'toPartner', emoji: '💬', label: '상대에게 한마디', placeholder: '오늘도 고마워, 라고 적어볼까...' },
];
