import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArchiveDetail, dailyQuestionApi } from '../../lib/api';
import { formatKoLong, weekdayKo } from '../../lib/date';
import { Icon } from '../../components/ui';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';

/** 지난 편지 하나 상세 (pushed). 질문 + 누가 골랐는지 + 두 답장 편지지. */
export default function QuestionDetailScreen() {
  const router = useRouter();
  const c = useColors();
  const { date } = useLocalSearchParams<{ date: string }>();

  const [detail, setDetail] = useState<ArchiveDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError(false);
    try {
      const res = await dailyQuestionApi.archiveDetail(date);
      setDetail(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const chosenLine = detail?.chosenBy?.nickname ? `${detail.chosenBy.nickname}가 고른 편지예요` : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={styles.topTitle}>{date ? formatKoLong(date) : '지난 편지'}</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading && !detail ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} size="large" />
        </View>
      ) : error && !detail ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>편지를 불러오지 못했어요.</Text>
        </View>
      ) : detail ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.dateSub}>{date ? weekdayKo(date) + '요일' : ''}</Text>

          {/* 질문 편지지 */}
          <View style={[styles.letter, shadow]}>
            <View style={[styles.letterSeal, { backgroundColor: c.primary }]}>
              <Icon name="heart" size={16} color={colors.white} />
            </View>
            <Text style={styles.letterLabel}>오늘의 질문</Text>
            <Text style={styles.letterQuestion}>{detail.questionText}</Text>
            {chosenLine ? <Text style={styles.chosenLine}>{chosenLine}</Text> : null}
          </View>

          {detail.opened ? (
            <>
              <AnswerCard
                label="내 답장"
                text={detail.myAnswer?.text}
                sealed={detail.myAnswer?.sealed}
                tint={c.primary}
              />
              <AnswerCard
                label={detail.partnerNickname ? `${detail.partnerNickname}의 답장` : '상대의 답장'}
                text={detail.partnerAnswer?.text}
                sealed={detail.partnerAnswer?.sealed}
                tint={colors.partner}
              />
            </>
          ) : (
            <View style={[styles.lockCard, shadow]}>
              <Icon name="lock-closed-outline" size={22} color={c.coralSoft} />
              <Text style={styles.lockText}>이 편지는 열리지 않은 채 보관되었어요.</Text>
            </View>
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

function AnswerCard({
  label,
  text,
  sealed,
  tint,
}: {
  label: string;
  text?: string;
  sealed?: boolean;
  tint: string;
}) {
  return (
    <View style={[styles.answerCard, shadow]}>
      <Text style={[styles.answerLabel, { color: tint }]}>{label}</Text>
      {sealed || !text ? (
        <Text style={styles.sealedText}>봉인된 채 남겨진 편지예요.</Text>
      ) : (
        <Text style={styles.answerText}>{text}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  emptyText: { ...font.body, color: colors.subText, textAlign: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  topTitle: { ...font.title },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl * 2 },
  dateSub: { ...font.caption, color: colors.subText, marginBottom: spacing.md },

  letter: {
    backgroundColor: '#FFFBF4',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  letterSeal: {
    position: 'absolute',
    top: -14,
    left: spacing.xl,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterLabel: { ...font.caption, color: colors.coralSoft, letterSpacing: 1 },
  letterQuestion: { fontSize: 19, fontWeight: '700', color: colors.text, lineHeight: 27, marginTop: spacing.sm },
  chosenLine: { ...font.caption, color: colors.subText, marginTop: spacing.md, fontStyle: 'italic' },

  answerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  answerLabel: { ...font.label, fontWeight: '700' },
  answerText: { ...font.body, lineHeight: 22, marginTop: spacing.sm },
  sealedText: { ...font.body, color: colors.placeholder, marginTop: spacing.sm, fontStyle: 'italic' },

  lockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  lockText: { ...font.body, color: colors.subText, flex: 1, lineHeight: 21 },
});
