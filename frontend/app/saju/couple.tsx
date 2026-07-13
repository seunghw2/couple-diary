import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SajuCouple, sajuApi } from '../../lib/api';
import { Icon, Button } from '../../components/ui';
import { SajuLoading } from '../../components/SajuLoading';
import { showToast } from '../../lib/dialog';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';

const SEEN_KEY = 'saju_seen_couple';

/** grade(궁합 등급, 높을수록 좋음) → 막대 색조. 브랜드 코럴 계열 + 중립. */
function gradeColor(c: { primary: string; coralSoft: string }, grade: number): string {
  if (grade >= 4) return c.primary;
  if (grade >= 3) return c.coralSoft;
  if (grade >= 2) return '#E8B96A';
  return '#B39685';
}

export default function SajuCouplePage() {
  const router = useRouter();
  const c = useColors();
  const [data, setData] = useState<SajuCouple | null>(null);
  const [error, setError] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [intro, setIntro] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    try {
      setError(false);
      setData(await sajuApi.couple());
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY).then((v) => setIntro(!v));
  }, []);
  const finishIntro = useCallback(async () => {
    await AsyncStorage.setItem(SEEN_KEY, '1');
    setIntro(false);
  }, []);

  async function requestBirthday() {
    if (requesting) return;
    setRequesting(true);
    try {
      await sajuApi.requestBirthday();
      showToast('상대에게 생일 등록을 요청했어요');
    } catch {
      showToast('요청에 실패했어요');
    } finally {
      setRequesting(false);
    }
  }

  async function onShare() {
    if (!data) return;
    try {
      await Share.share({
        message: `우리 사주 궁합 ${data.percent}% 💞\n${data.meName} × ${data.partnerName}\n${data.totalComment}`,
      });
    } catch {
      // 공유 취소는 무시.
    }
  }

  if (intro === null) return <View style={styles.safe} />;
  if (intro) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <SajuLoading label="우리 궁합을 푸는 중" onDone={finishIntro} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={[styles.topTitle, { color: c.primary }]}>우리 궁합</Text>
        <View style={{ width: 28 }} />
      </View>

      {data == null && !error ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: spacing.xxl }} />
      ) : error ? (
        <Text style={styles.empty}>불러오지 못했어요.</Text>
      ) : !data!.canCompute ? (
        <View style={styles.centerBox}>
          <Text style={styles.bigEmoji}>💌</Text>
          <Text style={styles.needTitle}>아직 궁합을 볼 수 없어요</Text>
          <Text style={styles.needSub}>{data!.blockReason ?? '조건이 갖춰지면 궁합을 볼 수 있어요.'}</Text>
          {data!.blockReason?.includes('상대') ? (
            <Button
              label="상대에게 생일 요청"
              icon="paper-plane-outline"
              loading={requesting}
              onPress={requestBirthday}
              style={{ marginTop: spacing.lg }}
            />
          ) : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* 점수 히어로 */}
          <View style={[styles.hero, shadow]}>
            <View style={styles.pairRow}>
              <View style={styles.person}>
                <Text style={styles.personEmoji}>{data!.meEmoji}</Text>
                <Text style={styles.personName}>{data!.meName}</Text>
              </View>
              <Text style={[styles.heart, { color: c.primary }]}>♥</Text>
              <View style={styles.person}>
                <Text style={styles.personEmoji}>{data!.partnerEmoji}</Text>
                <Text style={styles.personName}>{data!.partnerName}</Text>
              </View>
            </View>
            <Text style={[styles.percent, { color: c.primary }]}>{data!.percent}%</Text>
            {data!.relComment ? <Text style={styles.relComment}>{data!.relComment}</Text> : null}
          </View>

          {/* 카테고리 막대 */}
          <View style={[styles.card, shadow]}>
            <Text style={styles.cardHead}>항목별 궁합</Text>
            <View style={{ gap: spacing.md }}>
              {data!.categories.map((cat) => (
                <View key={cat.key}>
                  <View style={styles.catHead}>
                    <Text style={styles.catName}>{cat.name}</Text>
                    <Text style={styles.catScore}>{cat.score}</Text>
                  </View>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${Math.max(4, Math.min(100, cat.score))}%`, backgroundColor: gradeColor(c, cat.grade) },
                      ]}
                    />
                  </View>
                  {cat.comment ? <Text style={styles.catComment}>{cat.comment}</Text> : null}
                </View>
              ))}
            </View>
          </View>

          {/* 총평 */}
          {data!.totalComment ? (
            <View style={[styles.card, shadow]}>
              <Text style={styles.cardHead}>총평</Text>
              <Text style={styles.body}>{data!.totalComment}</Text>
            </View>
          ) : null}

          {/* 관계 꿀팁 */}
          {data!.tips && data!.tips.length > 0 ? (
            <View style={[styles.card, shadow]}>
              <Text style={styles.cardHead}>관계 꿀팁 💡</Text>
              {data!.tips.map((t, i) => (
                <Text key={i} style={styles.tip}>· {t}</Text>
              ))}
            </View>
          ) : null}

          {/* 배지 */}
          {data!.badges.length > 0 ? (
            <View style={styles.chipRow}>
              {data!.badges.map((b) => (
                <View key={b} style={[styles.chip, { backgroundColor: c.coralSofter }]}>
                  <Text style={styles.chipText}>{b}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Button label="궁합 공유하기" icon="share-outline" variant="soft" onPress={onShare} style={{ marginTop: spacing.sm }} />

          {data!.disclaimer ? <Text style={styles.disclaimer}>{data!.disclaimer}</Text> : null}
        </ScrollView>
      )}
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

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  bigEmoji: { fontSize: 52 },
  needTitle: { ...font.h2, marginTop: spacing.sm },
  needSub: { ...font.caption, color: colors.subText, textAlign: 'center' },

  hero: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  person: { alignItems: 'center', width: 84 },
  personEmoji: { fontSize: 40 },
  personName: { ...font.label, color: colors.text, marginTop: 4 },
  heart: { fontSize: 24 },
  percent: { fontSize: 52, fontWeight: '800', marginTop: spacing.md },
  relComment: { ...font.body, textAlign: 'center', marginTop: spacing.xs, lineHeight: 21 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHead: { ...font.title, marginBottom: spacing.md },
  tip: { ...font.body, color: colors.text, lineHeight: 25, marginTop: 5 },
  body: { ...font.body, color: colors.text, lineHeight: 25 },

  catHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  catName: { ...font.label, color: colors.text },
  catScore: { ...font.label, color: colors.subText },
  track: { height: 12, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  catComment: { ...font.caption, color: colors.subText, marginTop: 6, lineHeight: 20 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  chip: { borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6 },
  chipText: { ...font.label, color: colors.text },

  disclaimer: { ...font.caption, color: colors.subText, textAlign: 'center', marginTop: spacing.md },
  empty: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: spacing.xxl },
});
