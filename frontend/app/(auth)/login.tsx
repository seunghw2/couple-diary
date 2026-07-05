import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { ApiException } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { Button, Icon } from '../../components/ui';
import { colors, font, radius, shadow, spacing } from '../../theme/theme';

// 웹에서 인증 세션 리다이렉트를 정리하기 위해 모듈 로드 시 호출(네이티브는 no-op).
WebBrowser.maybeCompleteAuthSession();

// 카카오 브랜드 컬러(카카오 로그인 버튼 규격).
const KAKAO_YELLOW = '#FEE500';
const KAKAO_LABEL = '#191600';

export default function LoginScreen() {
  const devLogin = useAuthStore((s) => s.devLogin);
  const kakaoLogin = useAuthStore((s) => s.kakaoLogin);
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = nickname.trim().length > 0;
  const busy = loading || kakaoLoading;

  async function onLogin() {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await devLogin(nickname.trim());
      // 이후 라우팅은 _layout 가드가 처리 (커플 미연결이면 connect로).
    } catch (e) {
      setError(e instanceof ApiException ? e.message : '로그인에 실패했어요. 백엔드 연결을 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  }

  async function onKakao() {
    setError(null);
    setKakaoLoading(true);
    try {
      await kakaoLogin();
      // 성공 시 _layout 가드가 라우팅. 취소면 그대로 로그인 화면 유지.
    } catch (e) {
      setError(
        e instanceof ApiException
          ? e.message
          : e instanceof Error
            ? e.message
            : '카카오 로그인에 실패했어요.',
      );
    } finally {
      setKakaoLoading(false);
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
            <View style={styles.logoRow}>
              <Text style={styles.logo}>love today</Text>
              <Icon name="heart" size={30} color={colors.primary} />
            </View>
            <Text style={styles.tagline}>둘이 함께 쓰는 오늘의 일기</Text>
          </View>

          <View style={[styles.form, shadow]}>
            <Pressable
              onPress={onKakao}
              disabled={busy}
              style={({ pressed }) => [
                styles.kakaoBtn,
                pressed && { opacity: 0.85 },
                busy && { opacity: 0.6 },
              ]}
            >
              {kakaoLoading ? (
                <ActivityIndicator color={KAKAO_LABEL} />
              ) : (
                <View style={styles.kakaoInner}>
                  <Ionicons name="chatbubble" size={18} color={KAKAO_LABEL} />
                  <Text style={styles.kakaoLabel}>카카오로 시작하기</Text>
                </View>
              )}
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>또는</Text>
              <View style={styles.line} />
            </View>

            <Text style={styles.fieldLabel}>닉네임으로 시작 (개발용)</Text>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="달콩"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
            />

            <Button
              label="시작하기"
              variant="soft"
              onPress={onLogin}
              disabled={!canSubmit || busy}
              loading={loading}
              style={{ marginTop: spacing.lg }}
            />
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
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { fontSize: 40, fontWeight: '800', color: colors.primary },
  tagline: { ...font.body, color: colors.subText, marginTop: spacing.sm },
  form: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  kakaoBtn: {
    backgroundColor: KAKAO_YELLOW,
    borderRadius: radius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakaoInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kakaoLabel: { fontSize: 16, fontWeight: '700', color: KAKAO_LABEL },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xl },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...font.caption, color: colors.subText },
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
});
