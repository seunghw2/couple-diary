import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from './ui';
import { colors, font, spacing } from '../theme/theme';

/** 법적 문서 한 절: 소제목 + 문단들 + 불릿들(모두 선택). */
export type LegalSection = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
};

/**
 * 개인정보 처리방침·이용약관 공용 뷰. 뒤로가기 헤더 + 절 목록을 스크롤로 렌더.
 * 내용은 lib/legal.ts에서 주입한다.
 */
export function LegalDoc({
  title,
  subtitle,
  sections,
}: {
  title: string;
  subtitle?: string;
  sections: LegalSection[];
}) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={styles.topTitle}>{title}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {sections.map((s, i) => (
          <View key={i} style={styles.section}>
            {s.heading ? <Text style={styles.heading}>{s.heading}</Text> : null}
            {s.paragraphs?.map((p, j) => (
              <Text key={`p${j}`} style={styles.body}>
                {p}
              </Text>
            ))}
            {s.bullets?.map((b, j) => (
              <View key={`b${j}`} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        ))}
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
  topTitle: { ...font.h2 },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl * 2 },
  subtitle: { ...font.caption, color: colors.subText, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  heading: { ...font.label, color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  body: { ...font.body, color: colors.text, lineHeight: 23, marginBottom: spacing.sm },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs, paddingLeft: spacing.xs },
  bulletDot: { ...font.body, color: colors.subText, lineHeight: 23 },
  bulletText: { ...font.body, color: colors.text, lineHeight: 23, flex: 1 },
});
