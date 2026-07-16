import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorState } from '../components/ErrorState';
import { ScreenHeader } from '../components/ScreenHeader';
import { Toggle } from '../components/Toggle';
import { NotificationSettings, notificationSettingsApi } from '../lib/api';
import { showToast } from '../lib/dialog';
import { errorMessage } from '../lib/errors';
import { colors, font, radius, shadow, spacing } from '../theme/theme';

type Key = keyof NotificationSettings;

const ROWS: { key: Key; label: string; desc: string }[] = [
  { key: 'diary', label: '일기', desc: '상대가 일기를 쓰거나 공개·댓글을 남겼을 때' },
  { key: 'question', label: '오늘의 질문', desc: '편지 도착·상대 답장·편지 열림·댓글' },
  { key: 'poke', label: '콕 찌르기', desc: '상대가 콕 찔렀을 때' },
  { key: 'anniversary', label: '기념일', desc: '기념일이 다가올 때' },
  { key: 'worldcup', label: '월드컵 게임', desc: '상대가 완주하거나 결과를 비교할 수 있을 때' },
  { key: 'saju', label: '사주 궁합', desc: '생일 요청·궁합을 볼 수 있게 됐을 때' },
];

export default function NotificationSettingsScreen() {
  const [s, setS] = useState<NotificationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setS(await notificationSettingsApi.get());
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  useEffect(() => {
    load();
  }, []);

  const toggle = async (key: Key, value: boolean) => {
    if (!s) return;
    const prev = s;
    const next = { ...s, [key]: value };
    setS(next); // 낙관적 반영
    try {
      await notificationSettingsApi.update(next);
    } catch (e) {
      setS(prev); // 실패 시 롤백
      showToast(errorMessage(e, '설정을 저장하지 못했어요'));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="알림 설정" />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !s ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>받고 싶은 알림만 켜 두세요. 끈 알림은 푸시로 오지 않아요.</Text>
          <View style={styles.card}>
            {ROWS.map((r, i) => (
              <View key={r.key} style={[styles.row, i < ROWS.length - 1 && styles.rowBorder]}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{r.label}</Text>
                  <Text style={styles.rowDesc}>{r.desc}</Text>
                </View>
                <Toggle value={s[r.key]} onValueChange={(v) => toggle(r.key, v)} />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { ...font.caption, color: colors.subText, marginBottom: spacing.md, marginLeft: spacing.xs },
  card: { backgroundColor: colors.card, borderRadius: radius.md, ...shadow, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14, gap: spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1 },
  rowLabel: { ...font.body, fontWeight: '700', color: colors.text },
  rowDesc: { ...font.caption, color: colors.subText, marginTop: 2, lineHeight: 17 },
});
