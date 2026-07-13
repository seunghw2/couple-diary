import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { SajuDaily, SajuHub, sajuApi } from '../../lib/api';
import { Icon } from '../../components/ui';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';

/** 사주 궁합 허브 — 내 사주 / 우리 궁합 두 카드 + 오늘의 기운 배너. 설정 탭에서 진입. */
export default function SajuHome() {
  const router = useRouter();
  const c = useColors();
  const [hub, setHub] = useState<SajuHub | null>(null);
  const [daily, setDaily] = useState<SajuDaily | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const [h, d] = await Promise.all([sajuApi.hub(), sajuApi.daily().catch(() => null)]);
      setHub(h);
      setDaily(d);
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // 허브를 열면 '새 사주 소식' 배지 초기화(설정 배지 사라짐).
      sajuApi.markSeen().catch(() => {});
    }, [load])
  );

  const meSub = !hub
    ? ''
    : !hub.hasMyBirthday
      ? '생일을 먼저 등록해요'
      : '일간·오행으로 보는 나';
  const coupleSub = !hub
    ? ''
    : !hub.hasPartner
      ? '상대와 연결되면 볼 수 있어요'
      : !hub.hasPartnerBirthday
        ? '상대 생일이 등록되면 볼 수 있어요'
        : '둘의 궁합 점수 보기';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={[styles.topTitle, { color: c.primary }]}>우리 사주 궁합</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sub}>재미로 보는 사주 🔮</Text>

        {hub == null && !error ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: spacing.xxl }} />
        ) : error ? (
          <Text style={styles.empty}>불러오지 못했어요.</Text>
        ) : (
          <>
            <Pressable
              onPress={() => router.push('/saju/me')}
              style={({ pressed }) => [styles.card, shadow, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.emoji}>🌳</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>내 사주 보기</Text>
                <Text style={styles.cardSub}>{meSub}</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={colors.subText} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/saju/couple')}
              style={({ pressed }) => [styles.card, shadow, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.emoji}>💞</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>우리 궁합 보기</Text>
                <Text style={styles.cardSub}>{coupleSub}</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={colors.subText} />
            </Pressable>

            {daily ? (
              <View style={[styles.banner, { backgroundColor: c.coralSofter }]}>
                <View style={styles.bannerHead}>
                  <Text style={styles.bannerTitle}>오늘의 기운</Text>
                  <View style={[styles.colorDot, { backgroundColor: daily.colorHex }]} />
                  <Text style={styles.bannerColor}>{daily.colorName}</Text>
                </View>
                <Text style={styles.bannerFortune}>{daily.fortune}</Text>
                <Text style={styles.bannerKeyword}>키워드 · {daily.keyword}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  topTitle: { ...font.h2, fontWeight: '800' },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl * 2 },
  sub: { ...font.caption, color: colors.subText, marginBottom: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  emoji: { fontSize: 30 },
  cardTitle: { ...font.h2, fontSize: 17 },
  cardSub: { ...font.caption, color: colors.subText, marginTop: 3 },
  banner: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  bannerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bannerTitle: { ...font.title, flex: 1 },
  colorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.white },
  bannerColor: { ...font.label, color: colors.text },
  bannerFortune: { ...font.body, color: colors.text, marginTop: spacing.sm, lineHeight: 21 },
  bannerKeyword: { ...font.caption, color: colors.subText, marginTop: spacing.sm },
  empty: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: spacing.xxl },
});
