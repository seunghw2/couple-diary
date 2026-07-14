import { colors } from '../theme/theme';

/** 궁합(couple) 점수 구간색: 80+ 골드 · 60~79 브라운 · 0~59 로즈. */
export function coupleScoreColor(score: number): string {
  if (score >= 80) return colors.gold;
  if (score >= 60) return colors.brown;
  return colors.rose;
}

/** 궁합 점수 라벨: 찰떡 / 안정적 / 맞춰가기. */
export function coupleScoreLabel(score: number): string {
  if (score >= 80) return '찰떡';
  if (score >= 60) return '안정적';
  return '맞춰가기';
}

/** 오늘운세(daily) 점수 구간색: 80+ 골드 · 그 외 브라운. (60~99 긍정 밴드) */
export function dailyScoreColor(score: number): string {
  return score >= 80 ? colors.gold : colors.brown;
}
