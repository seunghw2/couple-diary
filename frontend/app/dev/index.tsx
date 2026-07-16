import { router } from 'expo-router';
import { ComponentProps, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorState } from '../../components/ErrorState';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../components/ui';
import { DevStats, devApi } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { colors, font, radius, shadow, spacing } from '../../theme/theme';

export default function DevHome() {
  const [stats, setStats] = useState<DevStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [excludeTest, setExcludeTest] = useState(false);

  const load = async () => {
    setError(null);
    try {
      setStats(await devApi.stats());
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="개발자도구" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !stats ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.statHeader}>
              <Text style={styles.groupLabel}>가입 · 커플 통계</Text>
              <View style={styles.toggle}>
                <Text style={styles.toggleLabel}>테스트 계정 제외</Text>
                <Switch
                  value={excludeTest}
                  onValueChange={setExcludeTest}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.white}
                />
              </View>
            </View>
            <View style={styles.statGrid}>
              <Stat label="총 사용자" value={excludeTest ? stats.usersReal : stats.users} />
              <Stat label="연결된 커플" value={excludeTest ? stats.couplesReal : stats.couples} />
              <Stat
                label="연결된 사용자"
                value={excludeTest ? stats.coupledUsersReal : stats.coupledUsers}
              />
              <Stat label="작성된 일기" value={stats.entries} />
              <Stat label="질문 뱅크" value={stats.questionsPool} />
              <Stat label="받은 의견" value={stats.feedback} />
            </View>
            {excludeTest ? (
              <Text style={styles.note}>카카오·애플 로그인 계정만 집계(devLogin 테스트 제외)</Text>
            ) : null}

            <Text style={styles.groupLabel}>목록</Text>
            <View style={styles.groupCard}>
              <Row
                icon="chatbubble-ellipses-outline"
                label="받은 의견"
                value={String(stats.feedback)}
                onPress={() => router.push('/dev/feedback')}
              />
              <Row
                icon="albums-outline"
                label="질문 뱅크 미리보기"
                value={String(stats.questionsPool)}
                onPress={() => router.push('/dev/questions')}
                last
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  last,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.rowIcon}>
        <Icon name={icon} size={17} color={colors.white} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <Icon name="chevron-forward" size={18} color={colors.subText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  groupLabel: { ...font.label, marginTop: spacing.lg, marginBottom: spacing.sm, marginLeft: spacing.xs },
  statHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggleLabel: { ...font.caption, color: colors.subText },
  note: { ...font.caption, color: colors.placeholder, marginTop: spacing.sm, marginLeft: spacing.xs },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    width: '31.5%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    ...shadow,
  },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.primary },
  statLabel: { ...font.caption, marginTop: 4, textAlign: 'center' },

  groupCard: { backgroundColor: colors.card, borderRadius: radius.md, ...shadow, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 14, gap: spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { ...font.body, fontWeight: '600', flex: 1 },
  rowValue: { ...font.caption, color: colors.subText },
});
