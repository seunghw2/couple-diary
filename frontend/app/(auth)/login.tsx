import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiException } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../../components/ui';
import { colors, font, radius, shadow, spacing } from '../../theme/theme';

export default function LoginScreen() {
  const devLogin = useAuthStore((s) => s.devLogin);
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && nickname.trim().length > 0;

  async function onLogin() {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await devLogin(email.trim(), nickname.trim());
      // 이후 라우팅은 _layout 가드가 처리 (커플 미연결이면 connect로).
    } catch (e) {
      setError(e instanceof ApiException ? e.message : '로그인에 실패했어요. 백엔드 연결을 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          <View style={styles.hero}>
            <Text style={styles.logo}>투데이 💗</Text>
            <Text style={styles.tagline}>둘이 함께 쓰는 오늘의 일기</Text>
          </View>

          <View style={[styles.form, shadow]}>
            <Text style={styles.fieldLabel}>이메일</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.border}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>닉네임</Text>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="달콩"
              placeholderTextColor={colors.border}
              style={styles.input}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              label="시작하기"
              onPress={onLogin}
              disabled={!canSubmit}
              loading={loading}
              style={{ marginTop: spacing.xl }}
            />
            <Text style={styles.devNote}>개발용 로그인 · 이메일/닉네임으로 바로 입장</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: spacing.xxl },
  logo: { fontSize: 40, fontWeight: '800', color: colors.primary },
  tagline: { ...font.body, color: colors.subText, marginTop: spacing.sm },
  form: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  fieldLabel: { ...font.label, marginBottom: spacing.sm },
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
  error: { ...font.caption, color: colors.danger, marginTop: spacing.md },
  devNote: { ...font.caption, textAlign: 'center', marginTop: spacing.md },
});
