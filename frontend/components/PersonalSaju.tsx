import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SajuPersonal } from '../lib/api';
import { OhaengBar } from './OhaengBar';
import { Collapsible } from './Collapsible';
import { colors, font, radius, shadow, spacing, useColors } from '../theme/theme';
import { cardStyles } from '../theme/cardStyles';

const PILLAR_LABELS = ['년주', '월주', '일주', '시주'];
const ORIGIN_EXPLAIN =
  '태어난 연·월·일·시를 각각 두 글자로 나타낸 네 기둥이에요. 각 기둥의 윗글자를 천간, 아랫글자를 지지라고 해요. ' +
  '그중 일주의 윗글자(일간)가 바로 나를 대표하고, 나머지 기둥은 나를 둘러싼 기운을 보여줘요. ' +
  '흐름으로는 년주=뿌리·초년, 월주=성장·사회, 일주=나와 짝, 시주=열매·말년으로도 읽어요. ' +
  '시주는 태어난 시각으로 채워지는 기둥이라, 생시를 넣으면 네 번째 기둥까지 완성돼요.';

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

/** 개인 사주 본문(내 사주 / 연인 사주 공용, 읽기 전용). hasBirthday=true 데이터 전제. */
export function PersonalSaju({
  data,
  showDaily = true,
  showDetail = true,
}: {
  data: SajuPersonal;
  showDaily?: boolean;
  showDetail?: boolean;
}) {
  const c = useColors();
  const subject = !data.ownerName ? '이 사람' : data.ownerName.endsWith('님') ? data.ownerName : `${data.ownerName}님`;

  // 설명을 문단으로 나누고 궁합 화면처럼 소제목을 붙여 보기 좋게.
  const descParas = (data.desc ?? '').split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const DESC_LABELS = ['타고난 결', '관계·사랑에선', '그리고 이런 면도'];

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
        <Text style={styles.cardHead}>오행으로 본 {subject}</Text>
        <OhaengBar items={data.ohaeng} />
        {data.ohaengInsight ? (
          <View style={[styles.insightBox, { backgroundColor: c.coralSofter }]}>
            <Text style={styles.insightText}>{data.ohaengInsight}</Text>
          </View>
        ) : null}
      </View>

      {/* 타고난 기질 (십성) */}
      {data.tenGodName ? (
        <View style={[styles.card, shadow]}>
          <Text style={styles.cardHead}>타고난 기질</Text>
          <View style={styles.tgHead}>
            <Text style={styles.tgEmoji}>{data.tenGodEmoji}</Text>
            <Text style={styles.tgName}>{data.tenGodName}</Text>
          </View>
          {data.tenGodKeywords && data.tenGodKeywords.length > 0 ? (
            <View style={styles.chipRow}>
              {data.tenGodKeywords.map((k) => (
                <View key={k} style={[styles.chip, { backgroundColor: c.coralSofter }]}>
                  <Text style={styles.chipText}>{k}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {data.tenGodDesc ? <Text style={styles.tgDesc}>{data.tenGodDesc}</Text> : null}
        </View>
      ) : null}

      {/* 이런 사람이에요 — 소제목으로 구조화 */}
      <View style={[styles.card, shadow]}>
        <Text style={styles.cardHead}>이런 사람이에요</Text>
        {data.oneLine ? <Text style={styles.pullQuote}>“{data.oneLine}”</Text> : null}
        {descParas.map((para, i) => {
          const label = descParas.length >= 2 ? DESC_LABELS[i] : undefined;
          return (
            <View key={i}>
              {label ? <Text style={[styles.subLabel, { color: c.primary }]}>{label}</Text> : null}
              <Text style={[styles.para, !label && i > 0 && { marginTop: spacing.md }]}>
                {emphasize(para, data.keywords)}
              </Text>
            </View>
          );
        })}
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

      {/* 사주 자세히 — 원국 + 뜻 설명 (읽기 전용) */}
      {showDetail ? (
        <View style={[styles.card, shadow]}>
          <Collapsible title="사주 자세히 보기">
            <Text style={styles.innerHead}>사주 원국</Text>
            <View style={styles.pillarRow}>
              {data.pillars.map((p, i) => (
                <View key={i} style={styles.pillar}>
                  <Text style={styles.pillarText}>{p}</Text>
                  <Text style={styles.pillarLabel}>{PILLAR_LABELS[i]}</Text>
                </View>
              ))}
            </View>
            {data.zodiac ? <Text style={styles.zodiac}>띠 · {data.zodiac}</Text> : null}
            <View style={styles.explainWrap}>
              <Collapsible title="사주 원국이란?">
                <Text style={styles.explain}>{ORIGIN_EXPLAIN}</Text>
              </Collapsible>
            </View>
          </Collapsible>
        </View>
      ) : null}

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

  hero: cardStyles.heroBase,
  heroCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 46 },
  heroHanja: { ...font.h1, fontSize: 30, marginTop: spacing.md },
  heroName: { ...font.title, color: colors.subText, marginTop: 2 },
  heroOneLine: { ...font.body, textAlign: 'center', marginTop: spacing.sm, lineHeight: 21 },
  heroTwist: { ...font.label, fontWeight: '700', textAlign: 'center', marginTop: spacing.xs, lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.md },
  chip: { borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5 },
  chipText: { ...font.label, color: colors.text },

  card: cardStyles.cardBase,
  cardHead: { ...cardStyles.cardHeadBase, marginBottom: spacing.sm },
  innerHead: { ...font.label, color: colors.text, marginBottom: spacing.sm },
  body: { ...font.body, color: colors.text, lineHeight: 22 },
  pullQuote: { ...font.h2, fontSize: 17, fontWeight: '800', color: colors.text, lineHeight: 24, marginBottom: spacing.md },
  para: { ...font.body, color: colors.text, lineHeight: 25 },
  insightBox: { borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  insightText: { ...font.body, color: colors.text, lineHeight: 24 },
  subHead: { fontSize: 12, fontWeight: '800', color: colors.primary, marginBottom: 5 },
  subLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3, marginTop: spacing.md, marginBottom: 5 },
  li: { ...font.body, color: colors.text, lineHeight: 22, marginTop: 2 },
  liGrow: { ...font.body, color: colors.subText, lineHeight: 22, marginTop: 2 },
  hint: { ...font.caption, color: colors.subText, marginTop: spacing.xs },
  tip: { ...font.body, color: colors.text, marginTop: spacing.sm },

  pillarRow: { flexDirection: 'row', gap: spacing.sm },
  pillar: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  pillarText: { ...font.h2, fontSize: 18 },
  pillarLabel: { ...font.caption, color: colors.subText, marginTop: 4 },
  zodiac: { ...font.caption, color: colors.subText, marginTop: spacing.sm },
  explainWrap: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  explain: { ...font.body, color: colors.subText, lineHeight: 23 },

  tgHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  tgEmoji: { fontSize: 30 },
  tgName: { ...font.h2, fontSize: 18, fontWeight: '800', color: colors.text, flex: 1 },
  tgDesc: { ...font.body, color: colors.text, lineHeight: 24, marginTop: spacing.md },

  dailyHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  colorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.border },
  dailyColor: { ...font.label, color: colors.text },

  disclaimer: { ...font.caption, color: colors.subText, textAlign: 'center', marginTop: spacing.sm },
});
