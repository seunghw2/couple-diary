import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { buildMonthGrid, parseISO, todayISO } from '../lib/date';
import { Button, Icon } from './ui';
import { colors, font, radius, shadow, spacing, useColors } from '../theme/theme';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

type Props = {
  visible: boolean;
  /** 초기 선택 날짜(YYYY-MM-DD). 없으면 오늘. */
  value?: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
  /** 이 날짜 이후는 선택 불가(YYYY-MM-DD). 예: 생일·기념일=미래 불가. */
  maxDate?: string;
  /** 이 날짜 이전은 선택 불가. */
  minDate?: string;
  title?: string;
};

/**
 * 앱 톤(코럴&크림) 캘린더 날짜 피커 — 하단 시트.
 * 숫자 키패드로 날짜를 치던 입력들을 대체. «»=연 이동, ‹›=월 이동, 완료로 확정.
 */
export function DatePickerSheet({ visible, value, onConfirm, onClose, maxDate, minDate, title = '날짜 선택' }: Props) {
  const c = useColors();
  const today = todayISO();
  const [selected, setSelected] = useState<string>(value || today);
  const [viewY, setViewY] = useState<number>(() => parseISO(value || today).getFullYear());
  const [viewM, setViewM] = useState<number>(() => parseISO(value || today).getMonth() + 1);

  // 열릴 때마다 현재 값 기준으로 뷰/선택 초기화.
  useEffect(() => {
    if (!visible) return;
    const base = value || today;
    setSelected(base);
    const d = parseISO(base);
    setViewY(d.getFullYear());
    setViewM(d.getMonth() + 1);
  }, [visible]);

  const cells = useMemo(() => buildMonthGrid(viewY, viewM), [viewY, viewM]);

  const step = (deltaMonth: number, deltaYear: number) => {
    let y = viewY + deltaYear;
    let m = viewM + deltaMonth;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setViewY(y);
    setViewM(m);
  };

  const disabled = (date: string) =>
    (maxDate ? date > maxDate : false) || (minDate ? date < minDate : false);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>

          {/* 연/월 네비 */}
          <View style={styles.nav}>
            <NavBtn icon="play-skip-back" onPress={() => step(0, -1)} />
            <NavBtn icon="chevron-back" onPress={() => step(-1, 0)} />
            <Text style={styles.navLabel}>{viewY}년 {viewM}월</Text>
            <NavBtn icon="chevron-forward" onPress={() => step(1, 0)} />
            <NavBtn icon="play-skip-forward" onPress={() => step(0, 1)} />
          </View>

          {/* 요일 헤더 */}
          <View style={styles.weekRow}>
            {WEEK.map((w, i) => (
              <Text
                key={w}
                style={[styles.weekLabel, i === 0 && { color: c.primary }, i === 6 && { color: colors.partner }]}
              >
                {w}
              </Text>
            ))}
          </View>

          {/* 날짜 그리드 */}
          <View style={styles.grid}>
            {cells.map((cell, idx) => {
              if (!cell.date) return <View key={`e-${idx}`} style={styles.cell} />;
              const date = cell.date;
              const isSel = date === selected;
              const isToday = date === today;
              const off = disabled(date);
              return (
                <Pressable
                  key={date}
                  style={styles.cell}
                  disabled={off}
                  onPress={() => setSelected(date)}
                >
                  <View style={[styles.dayCircle, isSel && { backgroundColor: c.primary }]}>
                    <Text
                      style={[
                        styles.dayNum,
                        isToday && !isSel && { color: c.primary, fontWeight: '800' },
                        isSel && { color: colors.white, fontWeight: '800' },
                        off && { color: colors.placeholder },
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Button label="취소" variant="ghost" onPress={onClose} style={styles.actionBtn} />
            <Button label="완료" onPress={() => onConfirm(selected)} style={styles.actionBtn} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NavBtn({ icon, onPress }: { icon: 'play-skip-back' | 'chevron-back' | 'chevron-forward' | 'play-skip-forward'; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.navBtn}>
      <Icon name={icon} size={18} color={colors.subText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(50, 35, 30, 0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    ...shadow,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  title: { ...font.h2, textAlign: 'center', marginBottom: spacing.md },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.md },
  navBtn: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  navLabel: { ...font.title, minWidth: 110, textAlign: 'center' },
  weekRow: { flexDirection: 'row' },
  weekLabel: { flex: 1, textAlign: 'center', ...font.caption, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayNum: { ...font.body, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { flex: 1 },
});
