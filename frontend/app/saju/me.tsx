import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SajuPersonal, sajuApi } from '../../lib/api';
import { Icon, Button } from '../../components/ui';
import { SajuLoading } from '../../components/SajuLoading';
import { PersonalSaju } from '../../components/PersonalSaju';
import { colors, font, spacing, useColors } from '../../theme/theme';

const SEEN_KEY = 'saju_seen_me';

export default function SajuMe() {
  const router = useRouter();
  const c = useColors();
  const [me, setMe] = useState<SajuPersonal | null>(null);
  const [firstVisit, setFirstVisit] = useState<boolean | null>(null);
  const [introTimeUp, setIntroTimeUp] = useState(false);
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

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY).then((v) => setFirstVisit(!v));
  }, []);
  const finishIntro = useCallback(async () => {
    await AsyncStorage.setItem(SEEN_KEY, '1');
    setIntroTimeUp(true);
  }, []);

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
        <PersonalSaju data={me!} showDaily />
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
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  bigEmoji: { fontSize: 52 },
  needTitle: { ...font.h2, marginTop: spacing.sm },
  needSub: { ...font.caption, color: colors.subText, textAlign: 'center' },
  empty: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: spacing.xxl },
});
