import { StyleSheet, Text, View } from 'react-native';
import { SajuOhaeng } from '../lib/api';
import { colors, font, spacing } from '../theme/theme';
import { barStyles } from '../theme/cardStyles';

/** 오행 이름 → 막대 색. 목 화 토 금 수 순. */
const OHAENG_COLOR: Record<string, string> = {
  목: '#5FBF7A',
  화: '#FF6F5C',
  토: '#D9A45B',
  금: '#9AA7B0',
  수: '#5B9BD9',
};

/**
 * 오행 분포 가로 막대(5줄). 순수 View — 새 의존성 없음.
 * 막대 길이는 count/전체 최대치 비율. 이모지 + 이름 + 옵션 count.
 */
export function OhaengBar({ items, showCount = true }: { items: SajuOhaeng[]; showCount?: boolean }) {
  const max = Math.max(1, ...items.map((o) => o.count));
  return (
    <View style={styles.wrap}>
      {items.map((o) => {
        const color = OHAENG_COLOR[o.name] ?? colors.coralSoft;
        const ratio = Math.max(0.06, o.count / max); // 0이어도 살짝 보이게
        return (
          <View key={o.elem} style={styles.row}>
            <Text style={styles.emoji}>{o.emoji}</Text>
            <Text style={styles.name}>{o.name}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
            </View>
            {showCount ? <Text style={styles.count}>{o.count}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emoji: { fontSize: 15, width: 20, textAlign: 'center' },
  name: { ...font.label, color: colors.text, width: 18 },
  track: { ...barStyles.track, flex: 1 },
  fill: barStyles.fill,
  count: { ...font.caption, color: colors.subText, width: 16, textAlign: 'right' },
});
