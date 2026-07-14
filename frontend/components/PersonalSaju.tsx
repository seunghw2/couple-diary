import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SajuPersonal } from '../lib/api';
import { HOUR_OPTIONS } from '../lib/sajuHours';
import { OhaengBar } from './OhaengBar';
import { Collapsible } from './Collapsible';
import { colors, font, radius, shadow, spacing, useColors } from '../theme/theme';

/** 문단 안의 키워드를 볼드로 강조(정돈형 가독성). */
function emphasize(text: string, keywords: string[]) {
  const kws = keywords.filter(Boolean).sort((a, b) => b.length - a.length);
  if (kws.length === 0) return text;
  const escaped = kws.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'g');
  return text.split(re).map((part, i) =>
    kws.includes(part) ? (
      <Text key={i} style={{ fontWeight: '800', color: colors.text }}>
        {part}
      </Text>
    ) : (
      part
    )
  );
}

type HourEdit = { selected: number | undefined; onPick: (h: number | null) => void; saving: boolean };

/** 개인 사주 본문(내 사주 / 연인 사주 공용). hasBirthday=true 데이터 전제. */
export function PersonalSaju({
  data,
  hourEdit,
  showDaily = true,
}: {
  data: SajuPersonal;
  hourEdit?: HourEdit; // 있으면 생시 편집 가능(내 사주), 없으면 원국만(연인)
  showDaily?: boolean;
}) {
  const c = useColors();
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* 일간 캐릭터 카드 */}
      <View style={[styles.hero, shadow]}>
        <View style={[styles.heroCircle, { backgroundColor: c.coralSofter }]}>
          <Text style={styles.heroEmoji}>{data.dayMasterEmoji}</Text>
        </View>
        <Text style={styles.heroHanja}>{data.dayMasterHanja}</Text>
        <Text style={styles.heroName}>{data.dayMasterName}</Text>
        <Text style={styles.heroOneLine}>{data.oneLine}</Text>
        {data.twist ? <Text style={[styles.heroTwist, { color: c.primary }]}>{data.twist}</Text> : null}
        {data.keywords.length > 0 ? (
          <View style={styles.chipRow}>
            {data.keywords.map((k) => (
              <View key={k} style={[styles.chip, { backgroundColor: c.coralSofter }]}>
                <Text style={styles.chipText}>{k}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* 오행으로 본 나 */}
      <View style={[styles.card, shadow]}>
        <Text style={styles.cardHead}>오행으로 본 나</Text>
        <OhaengBar items={data.ohaeng} />
        {data.ohaengInsight ? (
          <View style={[styles.insightBox, { backgroundColor: c.coralSofter }]}>
            <Text style={styles.insightText}>{data.ohaengInsight}</Text>
          </View>
        ) : null}
      </View>

      {/* 이런 사람이에요 */}
      <View style={[styles.card, shadow]}>
        <Text style={styles.cardHead}>이런 사람이에요</Text>
        {data.oneLine ? <Text style={styles.pullQuote}>“{data.oneLine}”</Text> : null}
        {data.desc.split(/\n\n+/).map((para, i) => (
          <Text key={i} style={[styles.para, i > 0 && { marginTop: spacing.md }]}>
            {emphasize(para.trim(), data.keywords)}
          </Text>
        ))}
      </View>

      {/* 강점 & 보완점 */}
      {data.strengths.length > 0 ? (
        <View style={[styles.card, shadow]}>
          <Text style={styles.cardHead}>강점 & 보완점</Text>
          <Text style={styles.subHead}>이런 점이 빛나요 ✨</Text>
          {data.strengths.map((s, i) => (
            <Text key={`s${i}`} style={styles.li}>· {s}</Text>
          ))}
          {data.growthPoints.length > 0 ? (
            <>
              <Text style={[styles.subHead, { marginTop: spacing.md }]}>이런 점을 채워가면 좋아요 🌱</Text>
              {data.growthPoints.map((g, i) => (
                <Text key={`g${i}`} style={styles.liGrow}>{g}</Text>
              ))}
            </>
          ) : null}
        </View>
      ) : null}

      {/* 사주 자세히 — 원국 (+ 내 사주면 생시 편집) */}
      <View style={[styles.card, shadow]}>
        <Collapsible title="사주 자세히 보기">
          <Text style={styles.innerHead}>사주 원국</Text>
          <View style={styles.pillarRow}>
            {data.pillars.map((p, i) => (
              <View key={i} style={styles.pillar}>
                <Text style={styles.pillarText}>{p}</Text>
              </View>
            ))}
          </View>
          {data.zodiac ? <Text style={styles.zodiac}>띠 · {data.zodiac}</Text> : null}

          {hourEdit ? (
            <>
              <Text style={[styles.innerHead, { marginTop: spacing.lg }]}>태어난 시(생시)</Text>
              <Text style={styles.hint}>생시를 넣으면 시주까지 더 정확해요.</Text>
              <View style={styles.hourGrid}>
                {HOUR_OPTIONS.map((o) => {
                  const active = hourEdit.selected === o.hour;
                  return (
                    <Pressable
                      key={o.hour}
                      disabled={hourEdit.saving}
                      onPress={() => hourEdit.onPick(o.hour)}
                      style={[styles.hourCell, active && { backgroundColor: c.primary, borderColor: c.primary }]}
                    >
                      <Text style={[styles.hourLabel, active && styles.hourLabelActive]}>{o.label}시</Text>
                      <Text style={[styles.hourRange, active && styles.hourLabelActive]}>{o.range}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  disabled={hourEdit.saving}
                  onPress={() => hourEdit.onPick(null)}
                  style={[styles.hourCell, hourEdit.selected === undefined && { backgroundColor: c.primary, borderColor: c.primary }]}
                >
                  <Text style={[styles.hourLabel, hourEdit.selected === undefined && styles.hourLabelActive]}>모름</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </Collapsible>
      </View>

      {/* 오늘의 기운 */}
      {showDaily && data.daily ? (
        <View style={[styles.card, shadow]}>
          <View style={styles.dailyHead}>
            <Text style={styles.cardHead}>오늘의 기운</Text>
            <View style={[styles.colorDot, { backgroundColor: data.daily.colorHex }]} />
            <Text style={styles.dailyColor}>{data.daily.colorName}</Text>
          </View>
          <Text style={styles.body}>{data.daily.fortune}</Text>
          <Text style={styles.hint}>키워드 · {data.daily.keyword}</Text>
          {data.daily.coupleTip ? <Text style={styles.tip}>💑 {data.daily.coupleTip}</Text> : null}
        </View>
      ) : null}

      {data.disclaimer ? <Text style={styles.disclaimer}>{data.disclaimer}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl * 2 },

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
  heroTwist: { ...font.label, fontWeight: '700', textAlign: 'center', marginTop: spacing.xs, lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.md },
  chip: { borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5 },
  chipText: { ...font.label, color: colors.text },

  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  cardHead: { ...font.title, marginBottom: spacing.sm },
  innerHead: { ...font.label, color: colors.text, marginBottom: spacing.sm },
  body: { ...font.body, color: colors.text, lineHeight: 22 },
  pullQuote: { ...font.h2, fontSize: 17, fontWeight: '800', color: colors.text, lineHeight: 24, marginBottom: spacing.md },
  para: { ...font.body, color: colors.text, lineHeight: 25 },
  insightBox: { borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  insightText: { ...font.body, color: colors.text, lineHeight: 24 },
  subHead: { ...font.label, color: colors.subText, marginBottom: 4 },
  li: { ...font.body, color: colors.text, lineHeight: 22, marginTop: 2 },
  liGrow: { ...font.body, color: colors.subText, lineHeight: 22, marginTop: 2 },
  hint: { ...font.caption, color: colors.subText, marginTop: spacing.xs },
  tip: { ...font.body, color: colors.text, marginTop: spacing.sm },

  pillarRow: { flexDirection: 'row', gap: spacing.sm },
  pillar: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
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
});
