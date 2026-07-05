import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildMonthGrid, parseISO, todayISO } from '../lib/date';
import { Button, Icon } from './ui';
import { colors, font, radius, shadow, spacing, useColors } from '../theme/theme';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const YEAR_ROW_H = 44;

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
  // 'grid' = 날짜 선택, 'ym' = 연·월 빠른 선택.
  const [mode, setMode] = useState<'grid' | 'ym'>('grid');
  const yearScrollRef = useRef<ScrollView>(null);

  // 열릴 때마다 현재 값 기준으로 뷰/선택 초기화.
  useEffect(() => {
    if (!visible) return;
    const base = value || today;
    setSelected(base);
    const d = parseISO(base);
    setViewY(d.getFullYear());
    setViewM(d.getMonth() + 1);
    setMode('grid');
  }, [visible]);

  const cells = useMemo(() => buildMonthGrid(viewY, viewM), [viewY, viewM]);

  // 연·월 빠른 선택에 쓸 연도 범위 (min/max 없으면 현재 기준 ±120년).
  const { minYear, maxYear } = useMemo(() => {
    const minY = minDate ? parseISO(minDate).getFullYear() : viewY - 120;
    const maxY = maxDate ? parseISO(maxDate).getFullYear() : viewY + 120;
    return { minYear: minY, maxYear: maxY };
  }, [minDate, maxDate, viewY]);

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = maxYear; y >= minYear; y--) arr.push(y);
    return arr;
  }, [minYear, maxYear]);

  // ym 모드로 진입할 때 현재 연도가 보이도록 스크롤.
  useEffect(() => {
    if (mode !== 'ym') return;
    const idx = years.indexOf(viewY);
    if (idx < 0) return;
    const t = setTimeout(() => {
      yearScrollRef.current?.scrollTo({ y: Math.max(0, (idx - 2) * YEAR_ROW_H), animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [mode]);

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

  // 해당 연/월이 min/max 범위를 완전히 벗어나면 비활성(그 달의 어떤 날짜도 선택 불가).
  const monthDisabled = (y: number, m: number) => {
    if (maxDate) {
      const md = parseISO(maxDate);
      if (y > md.getFullYear() || (y === md.getFullYear() && m > md.getMonth() + 1)) return true;
    }
    if (minDate) {
      const md = parseISO(minDate);
      if (y < md.getFullYear() || (y === md.getFullYear() && m < md.getMonth() + 1)) return true;
    }
    return false;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>

          {/* 연/월 네비 — 라벨 탭하면 연·월 빠른 선택으로 전환. */}
          <View style={styles.nav}>
            <NavBtn icon="chevron-back" onPress={() => step(-1, 0)} disabled={mode === 'ym'} />
            <Pressable
              onPress={() => setMode((prev) => (prev === 'grid' ? 'ym' : 'grid'))}
              hitSlop={6}
              style={styles.navLabelBtn}
            >
              <Text style={styles.navLabel}>{viewY}년 {viewM}월</Text>
              <Icon name={mode === 'ym' ? 'chevron-up' : 'chevron-down'} size={16} color={c.primary} />
            </Pressable>
            <NavBtn icon="chevron-forward" onPress={() => step(1, 0)} disabled={mode === 'ym'} />
          </View>

          {mode === 'grid' ? (
            <>
              {/* 요일 헤더 */}
              <View style={styles.weekRow}>
                {WEEK.map((w, i) => (
                  <Text
                    key={w}
                    style={[styles.weekLabel, (i === 0 || i === 6) && { color: c.primary }]}
                  >
                    {w}
                  </Text>
                ))}
              </View>

              {/* 날짜 그리드 (항상 6주 고정 높이) */}
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
            </>
          ) : (
            /* 연·월 빠른 선택: 왼쪽 스크롤 연도 리스트 + 오른쪽 3x4 월 그리드. */
            <View style={styles.ymWrap}>
              <ScrollView
                ref={yearScrollRef}
                style={styles.yearList}
                showsVerticalScrollIndicator={false}
              >
                {years.map((y) => {
                  const isSel = y === viewY;
                  return (
                    <Pressable key={y} style={styles.yearRow} onPress={() => setViewY(y)}>
                      <View style={[styles.yearPill, isSel && { backgroundColor: c.primary }]}>
                        <Text style={[styles.yearText, isSel && { color: colors.white, fontWeight: '800' }]}>
                          {y}년
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.monthGrid}>
                {MONTHS.map((label, i) => {
                  const m = i + 1;
                  const isSel = m === viewM;
                  const off = monthDisabled(viewY, m);
                  return (
                    <Pressable
                      key={label}
                      style={styles.monthCell}
                      disabled={off}
                      onPress={() => {
                        setViewM(m);
                        setMode('grid');
                      }}
                    >
                      <View style={[styles.monthPill, isSel && !off && { backgroundColor: c.primary }]}>
                        <Text
                          style={[
                            styles.monthText,
                            isSel && !off && { color: colors.white, fontWeight: '800' },
                            off && { color: colors.placeholder },
                          ]}
                        >
                          {label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.actions}>
            <Button label="취소" variant="ghost" onPress={onClose} style={styles.actionBtn} />
            <Button label="완료" onPress={() => onConfirm(selected)} style={styles.actionBtn} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NavBtn({ icon, onPress, disabled }: { icon: 'chevron-back' | 'chevron-forward'; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} disabled={disabled} style={[styles.navBtn, disabled && { opacity: 0 }]}>
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
  navLabelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minWidth: 130, paddingVertical: spacing.xs },
  navLabel: { ...font.title, textAlign: 'center' },
  weekRow: { flexDirection: 'row' },
  weekLabel: { flex: 1, textAlign: 'center', ...font.caption, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayNum: { ...font.body, color: colors.text },
  // 연·월 빠른 선택 — 그리드와 같은 세로 공간을 차지해 높이 유지(6주 그리드 ≈ 42*aspect).
  ymWrap: { flexDirection: 'row', height: 300, marginTop: spacing.xs, gap: spacing.md },
  yearList: { flex: 1 },
  yearRow: { height: YEAR_ROW_H, justifyContent: 'center' },
  yearPill: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, alignItems: 'center', backgroundColor: colors.bg },
  yearText: { ...font.body, color: colors.text, fontWeight: '600' },
  monthGrid: { flex: 1.3, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center' },
  monthCell: { width: '33.33%', paddingVertical: spacing.xs, alignItems: 'center' },
  monthPill: { width: '86%', paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.bg },
  monthText: { ...font.body, color: colors.text, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { flex: 1 },
});
