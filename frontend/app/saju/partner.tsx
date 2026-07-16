import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { SajuPersonal, sajuApi } from '../../lib/api';
import { SajuLoading } from '../../components/SajuLoading';
import { PersonalSaju } from '../../components/PersonalSaju';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ErrorState } from '../../components/ErrorState';
import { useFirstVisitIntro } from '../../hooks/useFirstVisitIntro';
import { colors, font, spacing, useColors } from '../../theme/theme';

export default function SajuPartner() {
  const c = useColors();
  const [data, setData] = useState<SajuPersonal | null>(null);
  const [name, setName] = useState<string>('연인');
  const { firstVisit, introTimeUp, finishIntro } = useFirstVisitIntro('saju_seen_partner');
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const [p, hub] = await Promise.all([sajuApi.partner(), sajuApi.hub().catch(() => null)]);
      setData(p);
      if (hub?.partnerName) setName(hub.partnerName);
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
  if (firstVisit && (!introTimeUp || (data == null && !error))) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <SajuLoading label="연인 사주를 푸는 중" onDone={finishIntro} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="연인 사주" />

      {data == null && !error ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: spacing.xxl }} />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : !data!.hasBirthday ? (
        <View style={styles.centerBox}>
          <Text style={styles.bigEmoji}>🎂</Text>
          <Text style={styles.needTitle}>아직 연인 사주를 볼 수 없어요</Text>
          <Text style={styles.needSub}>{name}님이 생일을 등록하면 일간과 오행을 볼 수 있어요.</Text>
        </View>
      ) : (
        <PersonalSaju data={data!} showDaily={false} showDetail={false} />
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
