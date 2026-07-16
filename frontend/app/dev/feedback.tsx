import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorState } from '../../components/ErrorState';
import { ScreenHeader } from '../../components/ScreenHeader';
import { DevFeedback, devApi } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { colors, font, radius, shadow, spacing } from '../../theme/theme';

const SOURCE_LABEL: Record<string, string> = {
  question: '오늘의 질문',
  saju: '사주 허브',
  saju_today: '오늘의 운세',
};

function fmt(iso: string) {
  // 2026-07-16T09:07:15 → 07.16 09:07
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[2]}.${m[3]} ${m[4]}:${m[5]}` : iso;
}

export default function DevFeedbackList() {
  const [items, setItems] = useState<DevFeedback[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setItems(await devApi.feedback());
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="받은 의견" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !items ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <Text style={styles.empty}>아직 받은 의견이 없어요.</Text>
        ) : (
          items.map((f) => (
            <View key={f.id} style={styles.card}>
              <View style={styles.metaRow}>
                <Text style={styles.who}>{f.userNickname}</Text>
                <View style={styles.metaRight}>
                  {f.source ? (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{SOURCE_LABEL[f.source] ?? f.source}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.date}>{fmt(f.createdAt)}</Text>
                </View>
              </View>
              <Text style={styles.content}>{f.content}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  empty: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, ...shadow },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  who: { ...font.body, fontWeight: '700' },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tag: { backgroundColor: colors.coralSofter, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: '700', color: colors.text },
  date: { ...font.caption, color: colors.placeholder },
  content: { ...font.body, color: colors.text, lineHeight: 22 },
});
