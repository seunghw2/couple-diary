import { useState } from 'react';
import {
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
import { DatePickerSheet } from '../../components/DatePickerSheet';
import { Button, Card, Icon } from '../../components/ui';
import { ApiException, authApi } from '../../lib/api';
import { todayISO } from '../../lib/date';
import { useAuthStore } from '../../store/useAuthStore';
import { colors, font, radius, spacing, useColors } from '../../theme/theme';

/**
 * 로그인 직후 온보딩 — 닉네임(프리필) + 생일 입력.
 * 표시 조건은 _layout 가드에서 판단(생일 미설정 사용자). 저장 후 bootstrap으로
 * user를 갱신하면 가드가 커플연결/홈으로 이동시킨다.
 */
export default function OnboardingScreen() {
  const c = useColors();
  const user = useAuthStore((s) => s.user);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [birthday, setBirthday] = useState(user?.birthday ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = nickname.trim().length > 0 && birthday.trim().length > 0;

  async function onSave() {
    const nick = nickname.trim();
    const bday = birthday.trim();
    if (!nick || !bday) return;
    setError(null);
    setSaving(true);
    try {
      await authApi.updateMe({ nickname: nick, birthday: bday });
      // user 갱신 → 가드가 커플연결/홈으로 이동.
      await bootstrap();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : '저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: c.primary }]}>반가워요!</Text>
          <Text style={styles.subtitle}>일기를 시작하기 전에 프로필을 알려주세요</Text>

          <Card style={{ marginTop: spacing.xl }}>
            <Text style={styles.label}>닉네임</Text>
            <TextInput
              value={nickname}
              onChangeText={(t) => {
                setNickname(t);
                setError(null);
              }}
              placeholder="닉네임"
              placeholderTextColor={colors.placeholder}
              maxLength={20}
              style={styles.input}
            />
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.label}>생일</Text>
            <Pressable style={styles.dateField} onPress={() => setPickerOpen(true)}>
              <Text style={[styles.dateText, !birthday && { color: colors.placeholder }]}>
                {birthday || '생일 선택'}
              </Text>
              <Icon name="calendar-outline" size={20} color={c.primary} />
            </Pressable>
          </Card>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label="시작하기"
            onPress={onSave}
            disabled={!canSave}
            loading={saving}
            style={{ marginTop: spacing.xl }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerSheet
        visible={pickerOpen}
        value={birthday}
        maxDate={todayISO()}
        title="생일 선택"
        onClose={() => setPickerOpen(false)}
        onConfirm={(d) => {
          setBirthday(d);
          setError(null);
          setPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  title: { ...font.h1 },
  subtitle: { ...font.body, color: colors.subText, marginTop: spacing.sm },
  label: { ...font.label, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 50,
    fontSize: 16,
    color: colors.text,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 50,
  },
  dateText: { fontSize: 16, color: colors.text },
  error: { ...font.caption, color: colors.danger, marginTop: spacing.md },
});
