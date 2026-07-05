import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MonthEntrySummary } from '../lib/api';
import { buildMonthGrid } from '../lib/date';
import { Badge, PhotoThumb } from './ui';
import { colors, font, radius, spacing, useColors } from '../theme/theme';

const WEEK_HEADERS = ['일', '월', '화', '수', '목', '금', '토'];
const THUMB_SIZE = 34;

type Props = {
  year: number;
  month: number; // 1~12
  entries: Record<string, MonthEntrySummary>;
  today: string;
  onPressDate: (date: string) => void;
  /** 캘린더에 콕 찍어둔 날(기념일 등). 일기가 없는 날만 작은 점으로 표시. */
  markedDates?: Set<string>;
};

export function CalendarGrid({ year, month, entries, today, onPressDate, markedDates }: Props) {
  const c = useColors();
  const cells = buildMonthGrid(year, month);

  return (
    <View>
      <View style={styles.weekRow}>
        {WEEK_HEADERS.map((w, i) => (
          <Text
            key={w}
            style={[styles.weekLabel, (i === 0 || i === 6) && { color: c.primary }]}
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
          // 콕 찍어둔 날(기념일 등): 일기가 있든 없든 날짜 숫자에 하이라이트 배경으로 항상 표시(4안).
          const marked = !!markedDates?.has(date);
          // 서버가 thumbSeed에 실제 이미지 경로(/files/...)를 줄 수도 있음
          const thumbUrl = e?.thumbSeed?.startsWith('/files/') ? e.thumbSeed : undefined;

          return (
            <Pressable key={date} style={styles.cell} onPress={() => onPressDate(date)}>
              {/* 날짜 숫자 + 마커가 반드시 같은 칸(dayWrap) 안에 들어가는 콘텐츠 기반 높이 레이아웃 */}
              <View style={[styles.dayWrap, isToday && styles.todayWrap]}>
                <Text
                  style={[
                    styles.dayNum,
                    isToday && { color: c.primary, fontWeight: '800' },
                    marked && [styles.dayNumMark, { backgroundColor: c.coralSofter, color: colors.text }],
                  ]}
                >
                  {cell.day}
                </Text>

                {hasContent ? (
                  <View>
                    {thumbUrl ? (
                      <PhotoThumb
                        url={thumbUrl}
                        seed={e.thumbSeed ?? date}
                        size={THUMB_SIZE}
                        ring={isToday}
                        label={<ThumbIcon status={e.status} />}
                      />
                    ) : (
                      // 실제 사진이 없는 스티커: 앱 코럴 톤으로 통일(보라 하드코딩 제거).
                      <View style={[styles.stickerThumb, { backgroundColor: c.primary }, isToday && [styles.stickerRing, { borderColor: c.coralSoft }]]}>
                        <ThumbIcon status={e.status} />
                      </View>
                    )}
                    {e.photoCount > 0 ? (
                      <View style={styles.badge}>
                        <Badge text={`${e.photoCount}`} />
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={[styles.emptyCircle, isToday && { borderColor: c.primary, borderStyle: 'solid' }]} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** 상태에 따른 대표 아이콘. LOCKED=자물쇠, 그 외 하트. */
function ThumbIcon({ status }: { status: MonthEntrySummary['status'] }) {
  const locked = status === 'LOCKED';
  return (
    <Ionicons
      name={locked ? 'lock-closed' : 'heart'}
      size={THUMB_SIZE * 0.44}
      color={colors.white}
    />
  );
}

const CELL_W = `${100 / 7}%` as const;

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', marginBottom: spacing.sm },
  weekLabel: { width: CELL_W, textAlign: 'center', ...font.label, color: colors.subText },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // aspectRatio를 쓰지 않고 내용(숫자+썸네일) 높이에 맞춰 셀 높이를 잡는다.
  // 고정비율 셀보다 내용이 커져 아랫줄로 넘쳐 보이던 문제(스티커가 한 주 아래 칸에 보임) 방지.
  cell: { width: CELL_W, alignItems: 'center', paddingVertical: 3 },
  dayWrap: {
    alignItems: 'center',
    borderRadius: radius.md,
    paddingVertical: 3,
    paddingHorizontal: 2,
    width: '92%',
  },
  todayWrap: { backgroundColor: '#FFEFE6' },
  dayNum: { ...font.caption, lineHeight: 14, color: colors.subText, marginBottom: 3 },
  // 기념일 하이라이트(4안): 날짜 숫자에 둥근 코럴 배경.
  dayNumMark: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, overflow: 'hidden', fontWeight: '700' },
  emptyCircle: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  badge: { position: 'absolute', top: -4, right: -4 },
  // 코럴 스티커(사진 없을 때). 이전엔 seed 그라데이션이라 날짜에 따라 보라색이 나오기도 했음.
  stickerThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerRing: { borderWidth: 3, borderColor: colors.coralSoft },
});
