import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { entryApi, MonthEntrySummary } from '../../lib/api';
import { dDay, formatDday, todayISO } from '../../lib/date';
import { useCoupleStore } from '../../store/useCoupleStore';
import { useAuthStore } from '../../store/useAuthStore';
import { CalendarGrid } from '../../components/CalendarGrid';
import { Button, Icon } from '../../components/ui';
import { colors, font, radius, shadow, spacing } from '../../theme/theme';

export default function HomeScreen() {
  const router = useRouter();
  const couple = useCoupleStore((s) => s.couple);
  const me = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.partner);
  const today = todayISO();

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const [entries, setEntries] = useState<Record<string, MonthEntrySummary>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (year: number, month: number) => {
      setLoading(true);
      setError(null);
      try {
        const list = await entryApi.month(year, month);
        const map: Record<string, MonthEntrySummary> = {};
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

  // 서버가 ddayCount를 주면 그대로, 없으면 anniversaryDate로 계산.
  const dday = useMemo(
    () => couple?.ddayCount ?? dDay(couple?.anniversaryDate),
    [couple?.ddayCount, couple?.anniversaryDate]
  );
  const partnerName = partner?.nickname;
  const todayEntry = entries[today];

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
          <View style={styles.logoRow}>
            <Text style={styles.logo}>love today</Text>
            <Icon name="heart" size={22} color={colors.primary} />
          </View>
          <Pressable
            style={styles.dday}
            onPress={dday == null ? () => router.push('/(tabs)/settings') : undefined}
          >
            <View style={styles.ddayRow}>
              <Icon name="heart" size={15} color={colors.primary} />
              <Text style={styles.ddayText}>
                {dday != null ? formatDday(dday) : '기념일 설정'}
              </Text>
            </View>
          </Pressable>
        </View>

        <Text style={styles.coupleLine}>
          {me?.nickname ?? '나'}
          {partnerName ? ` & ${partnerName}` : ' · 상대 대기 중'}
        </Text>

        {/* 상대가 기다려요 배너 */}
        {todayEntry?.partnerWritten && !todayEntry?.mineWritten ? (
          <Pressable
            style={styles.waitBanner}
            onPress={() => router.push({ pathname: '/write/[date]', params: { date: today } })}
          >
            <View style={styles.waitBannerRow}>
              <Icon name="mail-unread-outline" size={16} color={colors.primary} />
              <Text style={styles.waitBannerText}>
                {partnerName ?? '상대'}님이 오늘 일기를 썼어요 — 내가 쓰면 열려요
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* 월 네비게이션 */}
        <View style={styles.monthNav}>
          <Pressable onPress={() => shift(-1)} hitSlop={12}>
            <Icon name="chevron-back" size={26} color={colors.coralSoft} />
          </Pressable>
          <Text style={styles.monthTitle}>
            {cursor.year}. {cursor.month}
          </Text>
          <Pressable onPress={() => shift(1)} hitSlop={12}>
            <Icon name="chevron-forward" size={26} color={colors.coralSoft} />
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
          label="오늘 일기 쓰기"
          icon="create-outline"
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
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logo: { fontSize: 28, fontWeight: '800', color: colors.primary },
  dday: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...shadow,
  },
  ddayRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ddayText: { ...font.title, color: colors.primary },
  coupleLine: { ...font.label, color: colors.subText, marginTop: spacing.sm },
  waitBanner: {
    marginTop: spacing.md,
    backgroundColor: '#FFF3E4',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.coralSofter,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  waitBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  waitBannerText: { ...font.label, color: colors.primary, flex: 1 },
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
