import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { showAlert } from '../../lib/dialog';
import { subj } from '../../lib/josa';
import { useQuestionStore } from '../../store/useQuestionStore';
import { Button, Icon } from '../../components/ui';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';

const MAX_LEN = 2000;

/** 오늘의 질문에 답장 쓰기 (pushed). NEEDS_ANSWER가 아니면 자동으로 뒤로. */
export default function QuestionWriteScreen() {
  const router = useRouter();
  const c = useColors();
  const today = useQuestionStore((s) => s.today);
  const loading = useQuestionStore((s) => s.loading);
  const loadToday = useQuestionStore((s) => s.loadToday);
  const answer = useQuestionStore((s) => s.answer);

  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  // 내 답장이 이미 있으면 '수정' 모드.
  const isEdit = !!today?.myAnswer?.text;

  // 진입 시 최신 상태 확인.
  useEffect(() => {
    loadToday();
  }, [loadToday]);

  // 답장 쓰기(NEEDS_ANSWER)도 아니고 내 답장(수정)도 없으면 뒤로.
  useEffect(() => {
    if (!loading && today && today.state !== 'NEEDS_ANSWER' && !today.myAnswer) {
      router.back();
    }
  }, [loading, today, router]);

  // 수정 모드: 기존 답장 프리필(첫 로드 때만, 입력 중 값은 안 덮음).
  useEffect(() => {
    const prev = today?.myAnswer?.text;
    if (prev) setText((cur) => (cur ? cur : prev));
  }, [today?.myAnswer?.text]);

  const chosenLine = useMemo(() => {
    if (!today) return '';
    if (today.chosenByMe) return '내가 고른 편지예요';
    return today.chosenBy?.nickname ? `${subj(today.chosenBy.nickname)} 고른 편지예요` : '';
  }, [today]);

  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && !saving;

  async function onSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await answer(trimmed);
      router.back();
    } catch {
      showAlert('답장을 보내지 못했어요', '잠시 후 다시 시도해 주세요.');
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={styles.topTitle}>{isEdit ? '답장 수정' : '답장 쓰기'}</Text>
        <View style={{ width: 28 }} />
      </View>

      {!today && loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* 질문 요약 */}
            <View style={[styles.letter, shadow]}>
              <View style={[styles.letterSeal, { backgroundColor: c.primary }]}>
                <Icon name="heart" size={16} color={colors.white} />
              </View>
              <Text style={styles.letterLabel}>오늘의 질문</Text>
              <Text style={styles.letterQuestion}>{today?.question?.text ?? ''}</Text>
              {chosenLine ? <Text style={styles.chosenLine}>{chosenLine}</Text> : null}
            </View>

            {/* 편지지 입력 */}
            <View style={[styles.paper, shadow]}>
              <TextInput
                value={text}
                onChangeText={(v) => setText(v.slice(0, MAX_LEN))}
                placeholder="마음을 담아 답장을 써보세요…"
                placeholderTextColor={colors.placeholder}
                style={styles.input}
                multiline
                textAlignVertical="top"
                maxLength={MAX_LEN}
              />
              <Text style={styles.counter}>
                {text.length} / {MAX_LEN}
              </Text>
            </View>

            <Text style={styles.hint}>
              {isEdit
                ? '수정한 내용으로 답장이 바뀌어요.'
                : today?.partnerSealed
                ? '답장을 보내면 바로 편지가 열려요.'
                : '답장을 보내면 상대가 답할 때까지 서로의 편지가 잠겨 있어요.'}
            </Text>

            <Button
              label={isEdit ? '답장 수정하기' : '답장 보내기'}
              icon={isEdit ? 'create-outline' : 'paper-plane-outline'}
              onPress={onSubmit}
              loading={saving}
              disabled={!canSubmit}
              style={{ marginTop: spacing.lg }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

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
  topTitle: { ...font.h2 },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl * 2 },

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

  paper: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  input: {
    minHeight: 200,
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  counter: { ...font.caption, color: colors.subText, textAlign: 'right', marginTop: spacing.sm },
  hint: { ...font.caption, color: colors.subText, marginTop: spacing.md, lineHeight: 18 },
});
