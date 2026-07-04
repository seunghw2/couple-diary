import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { entryApi, EntrySummary } from '../../lib/api';
import { dDay, todayISO } from '../../lib/date';
import { useCoupleStore } from '../../store/useCoupleStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CalendarGrid } from '../../components/CalendarGrid';
import { Button } from '../../components/ui';
import { colors, font, radius, shadow, spacing } from '../../theme/theme';

export default function HomeScreen() {
  const router = useRouter();
  const couple = useCoupleStore((s) => s.couple);
  const me = useAuthStore((s) => s.user);
  const today = todayISO();

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const [entries, setEntries] = useState<Record<string, EntrySummary>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (year: number, month: number) => {
      setLoading(true);
      setError(null);
      try {
        const list = await entryApi.month(year, month);
        const map: Record<string, EntrySummary> = {};
        for (const e of list) map[e.date] = e;
        setEntries(map);
      } catch {
        setEntries({});
        setError('이번 달 일기를 불러오지 못했어요.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // 화면 포커스 시(작성 후 복귀 포함) 새로고침
  useFocusEffect(
    useCallback(() => {
      load(cursor.year, cursor.month);
    }, [cursor.year, cursor.month, load])
  );

  const dday = useMemo(() => dDay(couple?.anniversaryDate), [couple?.anniversaryDate]);
  const partnerName = couple?.partner?.nickname;

  function shift(delta: number) {
    setCursor((c) => {
      const m = c.month + delta;
      if (m < 1) return { year: c.year - 1, month: 12 };
      if (m > 12) return { year: c.year + 1, month: 1 };
      return { year: c.year, month: m };
    });
  }

  function openDate(date: string) {
    // 오늘 이후 미래는 작성 불가로 취급(상세만).
    router.push({ pathname: '/entry/[date]', params: { date } });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.logo}>투데이 💗</Text>
          <View style={styles.dday}>
            <Text style={styles.ddayText}>
              🔥 {dday != null ? `D+${dday}` : '기념일 설정'}
            </Text>
          </View>
        </View>

        <Text style={styles.coupleLine}>
          {me?.nickname ?? '나'}
          {partnerName ? ` 💕 ${partnerName}` : ' · 상대 대기 중'}
        </Text>

        {/* 월 네비게이션 */}
        <View style={styles.monthNav}>
          <Pressable onPress={() => shift(-1)} hitSlop={12}>
            <Text style={styles.navArrow}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>
            {cursor.year}. {cursor.month} 💕
          </Text>
          <Pressable onPress={() => shift(1)} hitSlop={12}>
            <Text style={styles.navArrow}>›</Text>
          </Pressable>
        </View>

        {/* 캘린더 */}
        <View style={[styles.calCard, shadow]}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xxl }} />
          ) : (
            <CalendarGrid
              year={cursor.year}
              month={cursor.month}
              entries={entries}
              today={today}
              onPressDate={openDate}
            />
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        {/* Today 버튼 */}
        <Button
          label="오늘 일기 쓰기 ✏️"
          onPress={() => router.push({ pathname: '/write/[date]', params: { date: today } })}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  logo: { fontSize: 28, fontWeight: '800', color: colors.primary },
  dday: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...shadow,
  },
  ddayText: { ...font.title, color: colors.primary },
  coupleLine: { ...font.label, color: colors.subText, marginTop: spacing.sm },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  navArrow: { fontSize: 28, color: colors.coralSoft, fontWeight: '700' },
  monthTitle: { ...font.h2, color: colors.text },
  calCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  error: { ...font.caption, color: colors.danger, textAlign: 'center', marginTop: spacing.md },
});
