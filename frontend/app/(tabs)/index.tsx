import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MonthEntrySummary } from '../../lib/api';
import { dDay, formatDday, todayISO } from '../../lib/date';
import { showAlert } from '../../lib/dialog';
import { useCoupleStore } from '../../store/useCoupleStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotifStore } from '../../store/useNotifStore';
import { useDataCache } from '../../store/useDataCache';
import { CalendarGrid } from '../../components/CalendarGrid';
import { Button, Icon } from '../../components/ui';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';

export default function HomeScreen() {
  const router = useRouter();
  const c = useColors();
  const couple = useCoupleStore((s) => s.couple);
  const me = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.partner);
  const today = todayISO();

  const unreadCount = useNotifStore((s) => s.unreadCount);
  const fetchNotif = useNotifStore((s) => s.fetch);
  const poke = useNotifStore((s) => s.poke);

  const loadMonth = useDataCache((s) => s.loadMonth);
  const getMonth = useDataCache((s) => s.getMonth);

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  // 캐시된 월이 있으면 즉시 그것으로 렌더(깜빡임 없음).
  const cachedMonth = getMonth(cursor.year, cursor.month);
  const [entries, setEntries] = useState<Record<string, MonthEntrySummary>>(cachedMonth ?? {});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [poking, setPoking] = useState(false);

  // 캐시우선 + 백그라운드 갱신. 캐시 없을 때만 스피너.
  const load = useCallback(
    async (year: number, month: number, force = false) => {
      const cached = getMonth(year, month);
      if (cached) setEntries(cached);
      else setLoading(true);
      const map = await loadMonth(year, month, { force });
      if (map) setEntries(map);
      setLoading(false);
    },
    [getMonth, loadMonth]
  );

  // 화면 포커스 시: 캐시우선 렌더 + 조용한 갱신 (전체 스피너 깜빡임 제거).
  useFocusEffect(
    useCallback(() => {
      load(cursor.year, cursor.month);
    }, [cursor.year, cursor.month, load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      load(cursor.year, cursor.month, true),
      useCoupleStore.getState().refresh(),
      fetchNotif(),
    ]);
    setRefreshing(false);
  }, [cursor.year, cursor.month, load, fetchNotif]);

  const dday = useMemo(
    () => couple?.ddayCount ?? dDay(couple?.anniversaryDate),
    [couple?.ddayCount, couple?.anniversaryDate]
  );
  const partnerName = partner?.nickname;
  const todayEntry = entries[today];

  function shift(delta: number) {
    setCursor((c) => {
      const m = c.month + delta;
      const next = m < 1 ? { year: c.year - 1, month: 12 } : m > 12 ? { year: c.year + 1, month: 1 } : { year: c.year, month: m };
      // 이동 즉시 캐시가 있으면 반영(스피너 없이 전환).
      const cached = getMonth(next.year, next.month);
      setEntries(cached ?? {});
      if (!cached) setLoading(true);
      return next;
    });
  }

  function openDate(date: string) {
    router.push({ pathname: '/entry/[date]', params: { date } });
  }

  async function onPoke() {
    if (poking) return;
    setPoking(true);
    const res = await poke();
    setPoking(false);
    if (res.ok) {
      showAlert('콕 찔렀어요!', '상대에게 알림이 갔어요');
    } else if (res.reason === 'not-connected') {
      showAlert('아직 보낼 수 없어요', '상대와 연결된 뒤 다시 시도해 주세요.');
    } else {
      showAlert('콕 찌르기에 실패했어요', '잠시 후 다시 시도해 주세요.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
        }
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Text style={[styles.logo, { color: c.primary }]}>love today</Text>
            <Icon name="heart" size={22} color={c.primary} />
          </View>
          <View style={styles.headerRight}>
            <Pressable
              style={styles.dday}
              onPress={dday == null ? () => router.push('/(tabs)/settings') : undefined}
            >
              <View style={styles.ddayRow}>
                <Icon name="heart" size={15} color={c.primary} />
                <Text style={[styles.ddayText, { color: c.primary }]}>
                  {dday != null ? formatDday(dday) : '기념일 설정'}
                </Text>
              </View>
            </Pressable>
            {/* 알림 벨 + 미읽음 뱃지 */}
            <Pressable style={styles.bell} onPress={() => router.push('/notifications')} hitSlop={8}>
              <Icon name="notifications-outline" size={24} color={colors.text} />
              {unreadCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: c.primary }]}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        <Text style={styles.coupleLine}>
          {me?.nickname ?? '나'}
          {partnerName ? ` & ${partnerName}` : ' · 상대 대기 중'}
        </Text>

        {/* 상대가 기다려요 배너 + 콕 찌르기 */}
        {todayEntry?.partnerWritten && !todayEntry?.mineWritten ? (
          <View style={[styles.waitBanner, { borderColor: c.coralSofter }]}>
            <Pressable
              style={styles.waitBannerRow}
              onPress={() => router.push({ pathname: '/write/[date]', params: { date: today } })}
            >
              <Icon name="mail-unread-outline" size={16} color={c.primary} />
              <Text style={[styles.waitBannerText, { color: c.primary }]}>
                {partnerName ?? '상대'}님이 오늘 일기를 썼어요 — 내가 쓰면 열려요
              </Text>
            </Pressable>
            <Pressable style={[styles.pokeBtn, { borderColor: c.coralSofter }]} onPress={onPoke} disabled={poking} hitSlop={6}>
              {poking ? (
                <ActivityIndicator color={c.primary} size="small" />
              ) : (
                <>
                  <Icon name="hand-left-outline" size={15} color={c.primary} />
                  <Text style={[styles.pokeText, { color: c.primary }]}>콕 찌르기</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}

        {/* 월 네비게이션 */}
        <View style={styles.monthNav}>
          <Pressable onPress={() => shift(-1)} hitSlop={12}>
            <Icon name="chevron-back" size={26} color={c.coralSoft} />
          </Pressable>
          <Text style={styles.monthTitle}>
            {cursor.year}. {cursor.month}
          </Text>
          <Pressable onPress={() => shift(1)} hitSlop={12}>
            <Icon name="chevron-forward" size={26} color={c.coralSoft} />
          </Pressable>
        </View>

        {/* 캘린더 — 캐시가 있으면 스피너 없이 즉시 렌더 */}
        <View style={[styles.calCard, shadow]}>
          {loading && Object.keys(entries).length === 0 ? (
            <ActivityIndicator color={c.primary} style={{ marginVertical: spacing.xxl }} />
          ) : (
            <CalendarGrid
              year={cursor.year}
              month={cursor.month}
              entries={entries}
              today={today}
              onPressDate={openDate}
            />
          )}
        </View>

        {/* Today 버튼 — 오늘 일기를 이미 썼으면 '작성 완료' 상태로 표시 */}
        {todayEntry?.mineWritten ? (
          <Button
            label="오늘 일기 작성 완료"
            icon="checkmark-circle"
            variant="soft"
            onPress={() => openDate(today)}
            style={{ marginTop: spacing.lg }}
          />
        ) : (
          <Button
            label="오늘 일기 쓰기"
            icon="create-outline"
            onPress={() => router.push({ pathname: '/write/[date]', params: { date: today } })}
            style={{ marginTop: spacing.lg }}
          />
        )}
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dday: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...shadow,
  },
  ddayRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ddayText: { ...font.title, color: colors.primary },
  bell: { padding: 2 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  coupleLine: { ...font.label, color: colors.subText, marginTop: spacing.sm },
  waitBanner: {
    marginTop: spacing.md,
    backgroundColor: '#FFF3E4',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.coralSofter,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  waitBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  waitBannerText: { ...font.label, color: colors.primary, flex: 1 },
  pokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.coralSofter,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    minHeight: 30,
  },
  pokeText: { ...font.label, color: colors.primary },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  monthTitle: { ...font.h2, color: colors.text },
  calCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
});
