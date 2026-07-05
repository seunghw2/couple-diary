import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { locationApi } from '../../lib/api';
import type { LocationCount } from '../../lib/api';
import { KakaoMap } from '../../components/KakaoMap';
import { Icon } from '../../components/ui';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';

type ViewMode = 'map' | 'list';

/** 지도 탭 — 일기에 남긴 장소들을 Kakao 핀맵 / 리스트로 모아보기. */
export default function MapScreen() {
  const c = useColors();
  const [places, setPlaces] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<ViewMode>('map');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await locationApi.list();
      setPlaces(Array.isArray(res?.locations) ? res.locations.filter(Boolean) : []);
      const map: Record<string, number> = {};
      (res?.counts ?? []).forEach((c: LocationCount) => {
        if (c?.name) map[c.name] = c.count;
      });
      setCounts(map);
    } catch {
      setPlaces([]);
      setCounts({});
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // 검색어로 필터링(지도·리스트 공통).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return places;
    return places.filter((p) => p.toLowerCase().includes(q));
  }, [places, query]);

  const onSelectPlace = useCallback((name: string) => setSelected(name), []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>우리의 지도</Text>
        <Text style={styles.sub}>
          우리가 함께 간 곳 <Text style={[styles.count, { color: c.primary }]}>{places.length}</Text>곳
        </Text>
      </View>

      {/* 검색(전체 폭) — 뷰 토글은 지도 위 하단 알약으로 이동 */}
      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <Icon name="search" size={16} color={colors.placeholder} />
          <TextInput
            style={styles.searchInput}
            placeholder="장소·동네로 찾기"
            placeholderTextColor={colors.placeholder}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Icon name="close-circle" size={18} color={colors.placeholder} />
            </Pressable>
          )}
        </View>
      </View>

      {/* 본문 */}
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : places.length === 0 ? (
          <View style={styles.center}>
            <Icon name="location-outline" size={44} color={colors.coralSoft} style={{ marginBottom: spacing.md }} />
            <Text style={styles.emptyTitle}>아직 기록된 장소가 없어요</Text>
            <Text style={styles.emptySub}>일기에 장소를 남기면 여기 지도에 모여요</Text>
          </View>
        ) : mode === 'map' ? (
          <KakaoMap places={filtered} counts={counts} onSelectPlace={onSelectPlace} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
            }
          >
            {filtered.length === 0 ? (
              <Text style={styles.noMatch}>'{query}'와 일치하는 장소가 없어요</Text>
            ) : (
              filtered.map((name) => (
                <Pressable
                  key={name}
                  style={({ pressed }) => [styles.placeCard, pressed && { opacity: 0.85 }]}
                  onPress={() => setSelected(name)}
                >
                  <View style={[styles.placeIcon, { backgroundColor: c.coralSofter }]}>
                    <Icon name="heart" size={16} color={c.primary} />
                  </View>
                  <Text style={styles.placeName} numberOfLines={1}>
                    {name}
                  </Text>
                  {counts[name] >= 2 && (
                    <View style={[styles.countPill, { backgroundColor: c.coralSofter }]}>
                      <Text style={[styles.countPillText, { color: c.primary }]}>{counts[name]}회</Text>
                    </View>
                  )}
                  <Icon name="chevron-forward" size={18} color={colors.placeholder} />
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        {/* 지도/리스트 토글 — 지도 위 하단 중앙 플로팅 알약(A안) */}
        {!loading && places.length > 0 && !selected && (
          <View style={styles.togglePill}>
            <PillSeg active={mode === 'map'} icon="map" label="지도" onPress={() => setMode('map')} tint={c.primary} />
            <PillSeg active={mode === 'list'} icon="list" label="리스트" onPress={() => setMode('list')} tint={c.primary} />
          </View>
        )}
      </View>

      {/* 선택된 장소 하단 시트 */}
      {selected && (
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={[styles.placeIcon, { backgroundColor: c.coralSofter }]}>
              <Icon name="heart" size={16} color={c.primary} />
            </View>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {selected}
            </Text>
            <Pressable onPress={() => setSelected(null)} hitSlop={8}>
              <Icon name="close" size={22} color={colors.subText} />
            </Pressable>
          </View>
          <Text style={styles.sheetSub}>
            {counts[selected] >= 2
              ? `우리가 ${counts[selected]}번 다녀온 곳이에요`
              : '우리가 함께 다녀온 곳이에요'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function PillSeg({
  active,
  icon,
  label,
  onPress,
  tint,
}: {
  active: boolean;
  icon: 'map' | 'list';
  label: string;
  onPress: () => void;
  tint: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pillSeg, active && { backgroundColor: tint }]}
      hitSlop={4}
    >
      <Icon
        name={active ? icon : (`${icon}-outline` as 'map-outline' | 'list-outline')}
        size={16}
        color={active ? colors.white : colors.subText}
      />
      <Text style={[styles.pillText, { color: active ? colors.white : colors.subText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...font.h1 },
  sub: { ...font.body, color: colors.subText, marginTop: 2 },
  count: { fontWeight: '800' },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, ...font.body, paddingVertical: 0 },
  togglePill: {
    position: 'absolute',
    bottom: spacing.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    padding: 4,
    ...shadow,
  },
  pillSeg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  pillText: { ...font.body, fontWeight: '700' },
  body: { flex: 1, marginHorizontal: spacing.xl, borderRadius: radius.lg, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { ...font.title },
  emptySub: { ...font.body, color: colors.subText, marginTop: spacing.xs, textAlign: 'center' },
  listContent: { paddingBottom: spacing.xl, gap: spacing.sm },
  noMatch: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: spacing.xl },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow,
  },
  placeIcon: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  placeName: { ...font.title, flex: 1 },
  countPill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  countPillText: { ...font.caption, fontWeight: '800' },
  sheet: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sheetTitle: { ...font.h2, flex: 1 },
  sheetSub: { ...font.body, color: colors.subText, marginTop: spacing.sm },
});
