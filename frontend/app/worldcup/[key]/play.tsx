import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WorldcupItem, worldcupApi } from '../../../lib/api';
import { showAlert, showToast } from '../../../lib/dialog';
import { Icon } from '../../../components/ui';
import { colors, font, radius, spacing, useColors } from '../../../theme/theme';

/** 상하 VS 탭 토너먼트. 우승까지 진행 후 결과 저장 → 상세로 복귀(축하+비교). */
export default function WorldcupPlay() {
  const router = useRouter();
  const c = useColors();
  const { key } = useLocalSearchParams<{ key: string }>();

  const [title, setTitle] = useState('');
  const [round, setRound] = useState<WorldcupItem[]>([]); // 이번 라운드 참가자
  const [winners, setWinners] = useState<WorldcupItem[]>([]); // 이번 라운드 승자 누적
  const [matchIdx, setMatchIdx] = useState(0); // 현재 대결 시작 인덱스(2씩)
  // 아이템 id → 탈락 라운드 사이즈(우승은 1). 전체 여정 기록.
  const stageMap = useRef<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const startRound = useCallback((list: WorldcupItem[]) => {
    setRound(list);
    setWinners([]);
    setMatchIdx(0);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const d = await worldcupApi.detail(key);
        setTitle(d.title);
        startRound(shuffle(d.items));
      } catch {
        showAlert('불러오기 실패', '잠시 후 다시 시도해 주세요.');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [key]);

  async function finish(winner: WorldcupItem) {
    stageMap.current[winner.id] = 1; // 우승
    // stageMap → {stage: [ids]} 페이로드로 변환.
    const stages: Record<number, number[]> = {};
    for (const [idStr, stage] of Object.entries(stageMap.current)) {
      (stages[stage] ??= []).push(Number(idStr));
    }
    setSaving(true);
    try {
      await worldcupApi.saveResult(key, winner.id, stages);
    } catch {
      // 저장 실패해도 결과 화면은 보여준다(다음 방문 시 재시도 가능).
      showToast('결과 저장에 실패했어요. 다음에 다시 시도돼요.');
    }
    router.replace({
      pathname: '/worldcup/[key]',
      params: { key, justWon: '1', winnerLabel: winner.label, winnerEmoji: winner.emoji },
    });
  }

  function pick(winner: WorldcupItem) {
    if (saving) return;
    // 진 쪽은 이번 라운드 사이즈에서 탈락(예: 32강 라운드에서 지면 stage=32).
    const first = round[matchIdx];
    const second = round[matchIdx + 1];
    const loser = winner.id === first.id ? second : first;
    if (loser) stageMap.current[loser.id] = round.length;

    const nextWinners = [...winners, winner];
    const nextIdx = matchIdx + 2;
    if (nextIdx < round.length) {
      setWinners(nextWinners);
      setMatchIdx(nextIdx);
      return;
    }
    // 라운드 종료
    if (nextWinners.length === 1) {
      finish(nextWinners[0]);
    } else {
      startRound(nextWinners);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={c.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  const a = round[matchIdx];
  const b = round[matchIdx + 1];
  const totalMatches = round.length / 2;
  const matchNo = matchIdx / 2 + 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="close" size={26} color={colors.subText} />
        </Pressable>
        <Text style={styles.topTitle}>{title}</Text>
        <View style={{ width: 26 }} />
      </View>

      <Text style={[styles.roundTag, { color: c.primary }]}>🔥 {roundLabel(round.length)}</Text>
      <Text style={styles.prog}>{matchNo} / {totalMatches}</Text>

      <View style={styles.arena}>
        <Candidate item={a} bg={c.primary} onPress={() => pick(a)} />
        <View style={[styles.vs, shadowVs]}>
          <Text style={[styles.vsText, { color: c.primary }]}>VS</Text>
        </View>
        <Candidate item={b} bg={colors.partner} onPress={() => pick(b)} />
      </View>
    </SafeAreaView>
  );
}

function Candidate({ item, bg, onPress }: { item?: WorldcupItem; bg: string; onPress: () => void }) {
  if (!item) return <View style={styles.card} />;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: bg }, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}>
      <Text style={styles.candEmoji}>{item.emoji}</Text>
      <Text style={styles.candName}>{item.label}</Text>
    </Pressable>
  );
}

function roundLabel(n: number): string {
  if (n === 2) return '결승';
  return `${n}강`;
}

/** Fisher-Yates. 앱 런타임이라 Math.random 사용 가능(워크플로 스크립트만 금지). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const shadowVs = {
  shadowColor: '#000',
  shadowOpacity: 0.15,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 4,
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  topTitle: { ...font.h2, fontSize: 17 },
  roundTag: { textAlign: 'center', fontSize: 15, fontWeight: '800', marginTop: spacing.sm },
  prog: { textAlign: 'center', ...font.caption, color: colors.subText, marginBottom: spacing.md },
  arena: { flex: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md, position: 'relative' },
  card: {
    flex: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  candEmoji: { fontSize: 64 },
  candName: { fontSize: 26, fontWeight: '800', color: colors.white },
  vs: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 54,
    height: 54,
    borderRadius: 27,
    marginLeft: -27,
    marginTop: -27,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  vsText: { fontSize: 18, fontWeight: '900' },
});
