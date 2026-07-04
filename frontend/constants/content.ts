/** 정적 콘텐츠: 기분 이모지, 템플릿 프롬프트, 질문 폴백, 사진 색시드 팔레트. */

export const MOODS = ['😆', '🥰', '🙂', '😌', '😢', '😴'] as const;

/** 템플릿 모드 빈칸(promptKey → 라벨). */
export const TEMPLATE_PROMPTS: { promptKey: string; emoji: string; label: string; placeholder: string }[] = [
  { promptKey: 'where', emoji: '📍', label: '오늘 어디서 뭐 했어?', placeholder: '오늘의 데이트를 적어봐...' },
  { promptKey: 'best', emoji: '💛', label: '오늘 제일 좋았던 순간은?', placeholder: '가장 좋았던 순간...' },
  { promptKey: 'toPartner', emoji: '💬', label: '상대에게 한마디', placeholder: '오늘도 고마워, 라고 적어볼까...' },
];

/** 자유 모드에서 고를 수 있는 질문 8개 (서버 /api/questions 실패 시 폴백). */
export const FALLBACK_QUESTIONS: { id: string; text: string }[] = [
  { id: 'q1', text: '오늘 나를 웃게 한 건?' },
  { id: 'q2', text: '요즘 우리가 자주 하는 말은?' },
  { id: 'q3', text: '다음에 같이 가고 싶은 곳은?' },
  { id: 'q4', text: '오늘 상대의 어떤 모습이 좋았어?' },
  { id: 'q5', text: '지금 가장 하고 싶은 건?' },
  { id: 'q6', text: '최근에 고마웠던 순간은?' },
  { id: 'q7', text: '오늘 하루를 한 단어로?' },
  { id: 'q8', text: '내일 함께 하고 싶은 건?' },
];

/** 사진 placeholder용 색시드 후보(추가 시 랜덤 배정). */
export const PHOTO_SEEDS = ['sunset', 'ocean', 'coffee', 'shrimp', 'flower', 'city', 'night', 'gift'];

export function randomSeed(): string {
  return PHOTO_SEEDS[Math.floor(Math.random() * PHOTO_SEEDS.length)] + '-' + Math.random().toString(36).slice(2, 6);
}
