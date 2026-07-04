import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EntrySummary } from '../lib/api';
import { buildMonthGrid } from '../lib/date';
import { Badge, SeedThumb } from './ui';
import { colors, font, radius, spacing } from '../theme/theme';

const WEEK_HEADERS = ['일', '월', '화', '수', '목', '금', '토'];

type Props = {
  year: number;
  month: number; // 1~12
  entries: Record<string, EntrySummary>;
  today: string;
  onPressDate: (date: string) => void;
};

export function CalendarGrid({ year, month, entries, today, onPressDate }: Props) {
  const cells = buildMonthGrid(year, month);

  return (
    <View>
      <View style={styles.weekRow}>
        {WEEK_HEADERS.map((w, i) => (
          <Text
            key={w}
            style={[styles.weekLabel, i === 0 && { color: colors.primary }, i === 6 && { color: colors.partner }]}
          >
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, idx) => {
          if (!cell.date) return <View key={`empty-${idx}`} style={styles.cell} />;
          const date = cell.date;
          const e = entries[date];
          const isToday = date === today;
          const hasContent = !!e && e.status !== 'EMPTY';

          return (
            <Pressable key={date} style={styles.cell} onPress={() => onPressDate(date)}>
              <View style={[styles.dayWrap, isToday && styles.todayWrap]}>
                <Text style={[styles.dayNum, isToday && { color: colors.primary, fontWeight: '800' }]}>
                  {cell.day}
                </Text>

                {hasContent ? (
                  <View>
                    <SeedThumb seed={e.thumbSeed ?? date} size={40} ring={isToday} label={thumbEmoji(e)} />
                    {e.photoCount > 0 ? (
                      <View style={styles.badge}>
                        <Badge text={`${e.photoCount}`} />
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={[styles.emptyCircle, isToday && { borderColor: colors.primary, borderStyle: 'solid' }]} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** 상태에 따른 대표 이모지. LOCKED=자물쇠, 그 외 하트. */
function thumbEmoji(e: EntrySummary): string {
  if (e.status === 'LOCKED') return '🔒';
  return '💗';
}

const CELL_W = `${100 / 7}%` as const;

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', marginBottom: spacing.sm },
  weekLabel: { width: CELL_W, textAlign: 'center', ...font.label, color: colors.subText },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL_W, aspectRatio: 0.82, alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 4 },
  dayWrap: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: radius.md,
    paddingVertical: 4,
    paddingHorizontal: 2,
    width: '92%',
  },
  todayWrap: { backgroundColor: '#FFEFE6' },
  dayNum: { ...font.caption, color: colors.subText, marginBottom: 4 },
  emptyCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  badge: { position: 'absolute', top: -4, right: -4 },
});
