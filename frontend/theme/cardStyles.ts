import { StyleSheet } from 'react-native';
import { colors, font, radius, spacing } from './theme';

/**
 * 사주 화면 공용 카드/히어로/진행바 프레임.
 * shadow는 사용처에서 [cardBase, shadow]로 합성. cardHead의 marginBottom은
 * 화면별로 달라(sm/md) 여기서 제외하고 사용처에서 지정.
 */
export const cardStyles = StyleSheet.create({
  cardBase: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeadBase: { ...font.title },
  heroBase: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
});

/** 진행바 트랙/필 (오행·궁합·오늘운세 공용). 너비·색은 사용처에서 인라인 병합. */
export const barStyles = StyleSheet.create({
  track: { height: 12, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
