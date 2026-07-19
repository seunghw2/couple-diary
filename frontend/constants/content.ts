/** 정적 콘텐츠: 기분, 템플릿 프롬프트. */
import type { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * 기분 선택지(24개). 앱 아웃라인 느낌에 맞춘 Tabler 라인 아이콘으로 표시.
 * 커플/데이트 앱이라 하트 계열(사랑·설렘) 포함. key=저장/식별용(기존 12개 키 하위호환 유지).
 * cat=감정 묶음('good' 좋아 / 'calm' 차분해 / 'hard' 힘들어) — 작성 화면에서 섹션 구분용.
 * (Tabler엔 heart-eyes가 없어 사랑은 mood-heart, 평온은 mood-check 사용)
 */
import type { Icon } from '@tabler/icons-react-native';
import {
  IconMoodHappy,
  IconMoodHeart,
  IconHearts,
  IconMoodCrazyHappy,
  IconMoodSmile,
  IconMoodWink,
  IconMoodNeutral,
  IconMoodNervous,
  IconMoodSad,
  IconMoodCry,
  IconMoodSick,
  IconMoodAngry,
  IconMoodKid,
  IconMoodTongue,
  IconMoodCheck,
  IconMoodSmileBeam,
  IconMoodEmpty,
  IconMoodConfuzed,
  IconMoodSing,
  IconMoodSurprised,
  IconMoodAnnoyed,
  IconMoodUnamused,
  IconMoodSadDizzy,
  IconZzz,
} from '@tabler/icons-react-native';

export type MoodIcon = Icon;
export type MoodCat = 'good' | 'calm' | 'hard';

export const MOODS: { key: string; label: string; Icon: MoodIcon; cat: MoodCat }[] = [
  // 좋아 ☀️
  { key: 'happy', label: '기쁨', Icon: IconMoodHappy, cat: 'good' },
  { key: 'smile', label: '미소', Icon: IconMoodSmile, cat: 'good' },
  { key: 'excited', label: '신남', Icon: IconMoodCrazyHappy, cat: 'good' },
  { key: 'love', label: '사랑', Icon: IconMoodHeart, cat: 'good' },
  { key: 'flutter', label: '설렘', Icon: IconHearts, cat: 'good' },
  { key: 'playful', label: '장난', Icon: IconMoodWink, cat: 'good' },
  { key: 'kid', label: '해맑음', Icon: IconMoodKid, cat: 'good' },
  { key: 'tongue', label: '익살', Icon: IconMoodTongue, cat: 'good' },
  // 차분해 🍃
  { key: 'calm', label: '평온', Icon: IconMoodCheck, cat: 'calm' },
  { key: 'proud', label: '뿌듯', Icon: IconMoodSmileBeam, cat: 'calm' },
  { key: 'soso', label: '그냥', Icon: IconMoodNeutral, cat: 'calm' },
  { key: 'empty', label: '멍', Icon: IconMoodEmpty, cat: 'calm' },
  { key: 'curious', label: '갸웃', Icon: IconMoodConfuzed, cat: 'calm' },
  { key: 'sing', label: '흥얼', Icon: IconMoodSing, cat: 'calm' },
  // 힘들어 🌧️
  { key: 'nervous', label: '긴장', Icon: IconMoodNervous, cat: 'hard' },
  { key: 'surprised', label: '놀람', Icon: IconMoodSurprised, cat: 'hard' },
  { key: 'annoyed', label: '짜증', Icon: IconMoodAnnoyed, cat: 'hard' },
  { key: 'unamused', label: '시큰둥', Icon: IconMoodUnamused, cat: 'hard' },
  { key: 'sad', label: '슬픔', Icon: IconMoodSad, cat: 'hard' },
  { key: 'cry', label: '울음', Icon: IconMoodCry, cat: 'hard' },
  { key: 'tired', label: '지침', Icon: IconMoodSadDizzy, cat: 'hard' },
  { key: 'sick', label: '아픔', Icon: IconMoodSick, cat: 'hard' },
  { key: 'angry', label: '화남', Icon: IconMoodAngry, cat: 'hard' },
  { key: 'sleepy', label: '졸림', Icon: IconZzz, cat: 'hard' },
];

/** 카테고리 섹션 메타(작성 화면 그룹 헤더용). */
export const MOOD_CATS: { cat: MoodCat; label: string }[] = [
  { cat: 'good', label: '좋아 ☀️' },
  { cat: 'calm', label: '차분해 🍃' },
  { cat: 'hard', label: '힘들어 🌧️' },
];

/** 저장된 mood key → 아이콘 컴포넌트. 없으면 undefined. */
export function moodIcon(key: string | null | undefined): MoodIcon | undefined {
  return MOODS.find((m) => m.key === key)?.Icon;
}

/** 저장된 mood key → 라벨(한글). 없으면 undefined. */
export function moodLabel(key: string | null | undefined): string | undefined {
  return MOODS.find((m) => m.key === key)?.label;
}

/** 템플릿 모드 빈칸(promptKey → 라벨). icon=라벨 앞 벡터 아이콘. */
export const TEMPLATE_PROMPTS: { promptKey: string; icon: IconName; label: string; placeholder: string }[] = [
  { promptKey: 'where', icon: 'location-outline', label: '오늘 어디서 뭐 했어?', placeholder: '오늘의 데이트를 적어봐...' },
  { promptKey: 'best', icon: 'heart-outline', label: '오늘 제일 좋았던 순간은?', placeholder: '가장 좋았던 순간...' },
  { promptKey: 'toPartner', icon: 'chatbox-outline', label: '상대에게 한마디', placeholder: '오늘도 고마워, 라고 적어볼까...' },
];
