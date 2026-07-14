import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { SajuDailyDetail, sajuApi } from '../../lib/api';
import { ScreenHeader } from '../../components/ScreenHeader';
import { dailyScoreColor } from '../../lib/sajuUi';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';
import { cardStyles, barStyles } from '../../theme/cardStyles';

const WD = ['일', '월', '화', '수', '목', '금', '토'];
function todayLabel(): string {
  const n = new Date();
  return `${n.getMonth() + 1}월 ${n.getDate()}일 ${WD[n.getDay()]}요일`;
}

export default function SajuToday() {
  const router = useRouter();
  const c = useColors();
  const [data, setData] = useState<SajuDailyDetail | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      setData(await sajuApi.dailyDetail());
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="오늘의 운세" />

      {data == null && !error ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: spacing.xxl }} />
      ) : error ? (
        <Text style={styles.empty}>불러오지 못했어요.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* 히어로: 점수 + 한 줄 */}
          <View style={[styles.hero, shadow]}>
            <Text style={styles.date}>{todayLabel()}</Text>
            <Text style={[styles.score, { color: dailyScoreColor(data!.totalScore) }]}>{data!.totalScore}</Text>
            <Text style={styles.totalLine}>{data!.totalLine}</Text>
            <Text style={styles.caption}>재미로 보는 오늘 기운 ✨</Text>
          </View>

          {/* 항목 4개 */}
          <View style={[styles.card, shadow]}>
            <Text style={styles.cardHead}>오늘의 항목운</Text>
            <View style={{ gap: spacing.lg }}>
              {data!.items.map((it) => (
                <View key={it.key}>
                  <View style={styles.itemHead}>
                    <Text style={styles.itemName}>
                      {it.icon} {it.name}
                    </Text>
                    <Text style={styles.itemScore}>{it.score}</Text>
                  </View>
                  <View style={barStyles.track}>
                    <View
                      style={[
                        barStyles.fill,
                        { width: `${Math.max(4, Math.min(100, it.score))}%`, backgroundColor: dailyScoreColor(it.score) },
                      ]}
                    />
                  </View>
                  <Text style={styles.itemComment}>{it.comment}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 행운 요소 */}
          <View style={[styles.card, shadow]}>
            <Text style={styles.cardHead}>오늘의 행운</Text>
            <View style={styles.luckRow}>
              <Text style={styles.luckLabel}>행운의 색</Text>
              <View style={styles.luckRight}>
                <View style={[styles.colorDot, { backgroundColor: data!.colorHex }]} />
                <Text style={styles.luckValue}>{data!.colorName}</Text>
              </View>
            </View>
            <View style={styles.luckRow}>
              <Text style={styles.luckLabel}>행운의 아이템</Text>
              <Text style={[styles.luckValue, styles.luckValueWrap]}>{data!.luckyItem}</Text>
            </View>
            <View style={styles.luckRow}>
              <Text style={styles.luckLabel}>오늘의 키워드</Text>
              <View style={[styles.kwChip, { backgroundColor: c.coralSofter }]}>
                <Text style={styles.kwText}>{data!.keyword}</Text>
              </View>
            </View>
            <View style={[styles.luckRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.luckLabel}>행운의 숫자</Text>
              <Text style={styles.luckValue}>{data!.luckyNumber}</Text>
            </View>
          </View>

          {/* 커플: 오늘 함께하기 좋은 것 */}
          {data!.coupleGood ? (
            <View style={[styles.card, shadow, { backgroundColor: c.coralSofter }]}>
              <Text style={styles.cardHead}>오늘 함께하면 좋은 것 💑</Text>
              <Text style={styles.coupleText}>{data!.coupleGood}</Text>
            </View>
          ) : null}

          {!data!.hasBirthday ? (
            <Pressable onPress={() => router.push('/account')} style={styles.hintCard}>
              <Text style={styles.hintText}>생일을 넣으면 나에게 딱 맞춘 오늘 운세가 나와요 →</Text>
            </Pressable>
          ) : null}

          {data!.disclaimer ? <Text style={styles.disclaimer}>{data!.disclaimer}</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl * 2 },

  hero: cardStyles.heroBase,
  date: { ...font.caption, color: colors.subText },
  score: { fontSize: 64, fontWeight: '800', marginTop: spacing.xs },
  totalLine: { ...font.body, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
  caption: { ...font.caption, color: colors.subText, marginTop: spacing.md },

  card: cardStyles.cardBase,
  cardHead: { ...cardStyles.cardHeadBase, marginBottom: spacing.md },

  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  itemName: { ...font.label, color: colors.text, fontSize: 14 },
  itemScore: { ...font.label, color: colors.subText },
  itemComment: { ...font.caption, color: colors.subText, marginTop: 8, lineHeight: 21, fontSize: 13 },

  luckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  luckLabel: { ...font.label, color: colors.subText },
  luckRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  luckValue: { ...font.body, fontWeight: '700', color: colors.text },
  luckValueWrap: { flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },
  colorDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  kwChip: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  kwText: { ...font.label, color: colors.text },

  coupleText: { ...font.body, color: colors.text, lineHeight: 23 },

  hintCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  hintText: { ...font.body, color: colors.subText },

  disclaimer: { ...font.caption, color: colors.subText, textAlign: 'center', marginTop: spacing.sm },
  empty: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: spacing.xxl },
});
