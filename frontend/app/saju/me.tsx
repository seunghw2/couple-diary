import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { SajuPersonal, sajuApi } from '../../lib/api';
import { Button } from '../../components/ui';
import { SajuLoading } from '../../components/SajuLoading';
import { PersonalSaju } from '../../components/PersonalSaju';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ErrorState } from '../../components/ErrorState';
import { useFirstVisitIntro } from '../../hooks/useFirstVisitIntro';
import { colors, font, spacing, useColors } from '../../theme/theme';

export default function SajuMe() {
  const router = useRouter();
  const c = useColors();
  const [me, setMe] = useState<SajuPersonal | null>(null);
  const { firstVisit, introTimeUp, finishIntro } = useFirstVisitIntro('saju_seen_me');
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      setMe(await sajuApi.me());
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (firstVisit === null) return <View style={styles.safe} />;
  if (firstVisit && (!introTimeUp || (me == null && !error))) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <SajuLoading label="내 사주를 푸는 중" onDone={finishIntro} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="내 사주" />

      {me == null && !error ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: spacing.xxl }} />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : !me!.hasBirthday ? (
        <View style={styles.centerBox}>
          <Text style={styles.bigEmoji}>🎂</Text>
          <Text style={styles.needTitle}>생일을 먼저 등록해요</Text>
          <Text style={styles.needSub}>생일을 넣으면 나의 일간과 오행을 볼 수 있어요.</Text>
          <Button label="생일 등록하러 가기" onPress={() => router.push('/account')} style={{ marginTop: spacing.lg }} />
        </View>
      ) : (
        <PersonalSaju data={me!} showDaily={false} showDetail={false} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  bigEmoji: { fontSize: 52 },
  needTitle: { ...font.h2, marginTop: spacing.sm },
  needSub: { ...font.caption, color: colors.subText, textAlign: 'center' },
  empty: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: spacing.xxl },
});
