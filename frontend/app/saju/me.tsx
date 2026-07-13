import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { SajuPersonal, sajuApi } from '../../lib/api';
import { Icon, Button } from '../../components/ui';
import { OhaengBar } from '../../components/OhaengBar';
import { showToast } from '../../lib/dialog';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';

/** 생시(12지시) 옵션. hour = 각 지지 시작시각. 모름 = null. */
const HOUR_OPTIONS: { hour: number; label: string; range: string }[] = [
  { hour: 23, label: '자', range: '23~01' },
  { hour: 1, label: '축', range: '01~03' },
  { hour: 3, label: '인', range: '03~05' },
  { hour: 5, label: '묘', range: '05~07' },
  { hour: 7, label: '진', range: '07~09' },
  { hour: 9, label: '사', range: '09~11' },
  { hour: 11, label: '오', range: '11~13' },
  { hour: 13, label: '미', range: '13~15' },
  { hour: 15, label: '신', range: '15~17' },
  { hour: 17, label: '유', range: '17~19' },
  { hour: 19, label: '술', range: '19~21' },
  { hour: 21, label: '해', range: '21~23' },
];

export default function SajuMe() {
  const router = useRouter();
  const c = useColors();
  const [me, setMe] = useState<SajuPersonal | null>(null);
  const [error, setError] = useState(false);
  const [savingHour, setSavingHour] = useState(false);
  // 현재 저장된 생시(지지 시작시각). undefined=모름/미설정. hub에서 seed.
  const [selectedHour, setSelectedHour] = useState<number | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      setError(false);
      const [m, hub] = await Promise.all([sajuApi.me(), sajuApi.hub().catch(() => null)]);
      setMe(m);
      if (hub) setSelectedHour(hub.myBirthTime);
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function pickHour(hour: number | null) {
    if (savingHour) return;
    setSavingHour(true);
    setSelectedHour(hour ?? undefined); // 즉시 강조
    try {
      await sajuApi.setBirthTime(hour);
      await load();
    } catch {
      showToast('생시 저장에 실패했어요');
    } finally {
      setSavingHour(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={[styles.topTitle, { color: c.primary }]}>내 사주</Text>
        <View style={{ width: 28 }} />
      </View>

      {me == null && !error ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: spacing.xxl }} />
      ) : error ? (
        <Text style={styles.empty}>불러오지 못했어요.</Text>
      ) : !me!.hasBirthday ? (
        <View style={styles.centerBox}>
          <Text style={styles.bigEmoji}>🎂</Text>
          <Text style={styles.needTitle}>생일을 먼저 등록해요</Text>
          <Text style={styles.needSub}>생일을 넣으면 나의 일간과 오행을 볼 수 있어요.</Text>
          <Button label="생일 등록하러 가기" onPress={() => router.push('/account')} style={{ marginTop: spacing.lg }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* 일간 캐릭터 카드 */}
          <View style={[styles.hero, shadow]}>
            <View style={[styles.heroCircle, { backgroundColor: c.coralSofter }]}>
              <Text style={styles.heroEmoji}>{me!.dayMasterEmoji}</Text>
            </View>
            <Text style={styles.heroHanja}>{me!.dayMasterHanja}</Text>
            <Text style={styles.heroName}>{me!.dayMasterName}</Text>
            <Text style={styles.heroOneLine}>{me!.oneLine}</Text>
            {me!.keywords.length > 0 ? (
              <View style={styles.chipRow}>
                {me!.keywords.map((k) => (
                  <View key={k} style={[styles.chip, { backgroundColor: c.coralSofter }]}>
                    <Text style={styles.chipText}>{k}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* 오행 분포 */}
          <View style={[styles.card, shadow]}>
            <Text style={styles.cardHead}>오행 분포</Text>
            <OhaengBar items={me!.ohaeng} />
          </View>

          {/* 성격 */}
          <View style={[styles.card, shadow]}>
            <Text style={styles.cardHead}>이런 사람이에요</Text>
            <Text style={styles.body}>{me!.desc}</Text>
            {me!.growth ? <Text style={styles.growth}>🌱 {me!.growth}</Text> : null}
          </View>

          {/* 사주 기둥 */}
          <View style={[styles.card, shadow]}>
            <Text style={styles.cardHead}>사주 원국</Text>
            <View style={styles.pillarRow}>
              {me!.pillars.map((p, i) => (
                <View key={i} style={styles.pillar}>
                  <Text style={styles.pillarText}>{p}</Text>
                </View>
              ))}
            </View>
            {me!.zodiac ? <Text style={styles.zodiac}>띠 · {me!.zodiac}</Text> : null}
          </View>

          {/* 생시 선택 */}
          <View style={[styles.card, shadow]}>
            <Text style={styles.cardHead}>태어난 시(생시)</Text>
            <Text style={styles.hint}>생시를 넣으면 시주까지 더 정확해요.</Text>
            <View style={styles.hourGrid}>
              {HOUR_OPTIONS.map((o) => {
                const active = selectedHour === o.hour;
                return (
                  <Pressable
                    key={o.hour}
                    disabled={savingHour}
                    onPress={() => pickHour(o.hour)}
                    style={[styles.hourCell, active && { backgroundColor: c.primary, borderColor: c.primary }]}
                  >
                    <Text style={[styles.hourLabel, active && styles.hourLabelActive]}>{o.label}시</Text>
                    <Text style={[styles.hourRange, active && styles.hourLabelActive]}>{o.range}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                disabled={savingHour}
                onPress={() => pickHour(null)}
                style={[
                  styles.hourCell,
                  selectedHour === undefined && { backgroundColor: c.primary, borderColor: c.primary },
                ]}
              >
                <Text style={[styles.hourLabel, selectedHour === undefined && styles.hourLabelActive]}>모름</Text>
              </Pressable>
            </View>
          </View>

          {/* 오늘의 기운 */}
          {me!.daily ? (
            <View style={[styles.card, shadow]}>
              <View style={styles.dailyHead}>
                <Text style={styles.cardHead}>오늘의 기운</Text>
                <View style={[styles.colorDot, { backgroundColor: me!.daily.colorHex }]} />
                <Text style={styles.dailyColor}>{me!.daily.colorName}</Text>
              </View>
              <Text style={styles.body}>{me!.daily.fortune}</Text>
              <Text style={styles.hint}>키워드 · {me!.daily.keyword}</Text>
              {me!.daily.coupleTip ? <Text style={styles.tip}>💑 {me!.daily.coupleTip}</Text> : null}
            </View>
          ) : null}

          {me!.disclaimer ? <Text style={styles.disclaimer}>{me!.disclaimer}</Text> : null}
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
  heroCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 46 },
  heroHanja: { ...font.h1, fontSize: 30, marginTop: spacing.md },
  heroName: { ...font.title, color: colors.subText, marginTop: 2 },
  heroOneLine: { ...font.body, textAlign: 'center', marginTop: spacing.sm, lineHeight: 21 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.md },
  chip: { borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5 },
  chipText: { ...font.label, color: colors.text },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHead: { ...font.title, marginBottom: spacing.sm },
  body: { ...font.body, color: colors.text, lineHeight: 22 },
  growth: { ...font.body, color: colors.subText, marginTop: spacing.sm, lineHeight: 21 },
  hint: { ...font.caption, color: colors.subText, marginTop: spacing.xs },
  tip: { ...font.body, color: colors.text, marginTop: spacing.sm },

  pillarRow: { flexDirection: 'row', gap: spacing.sm },
  pillar: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  pillarText: { ...font.h2, fontSize: 18 },
  zodiac: { ...font.caption, color: colors.subText, marginTop: spacing.sm },

  hourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  hourCell: {
    width: '22%',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourLabel: { ...font.label, color: colors.text },
  hourRange: { ...font.caption, color: colors.subText, marginTop: 1 },
  hourLabelActive: { color: colors.white },

  dailyHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  colorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.border },
  dailyColor: { ...font.label, color: colors.text },

  disclaimer: { ...font.caption, color: colors.subText, textAlign: 'center', marginTop: spacing.sm },
  empty: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: spacing.xxl },
});
