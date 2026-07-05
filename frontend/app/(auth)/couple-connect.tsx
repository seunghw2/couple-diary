import { useEffect, useState } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiException } from '../../lib/api';
import { confirmAsync } from '../../lib/dialog';
import { useAuthStore } from '../../store/useAuthStore';
import { useCoupleStore } from '../../store/useCoupleStore';
import { Button, Card, Icon } from '../../components/ui';
import { colors, font, radius, spacing } from '../../theme/theme';

export default function CoupleConnectScreen() {
  const logout = useAuthStore((s) => s.logout);
  const { invite, connect } = useCoupleStore();

  const [myCode, setMyCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [partnerCode, setPartnerCode] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 진입 시 내 초대코드 발급
  useEffect(() => {
    (async () => {
      try {
        const code = await invite();
        setMyCode(code);
      } catch {
        setMyCode(null);
      } finally {
        setInviteLoading(false);
      }
    })();
  }, []);

  // 상대가 내 코드로 연결하면 이 화면이 멈춰 있으므로, 화면에 있는 동안
  // 주기적으로 연결 상태를 재조회한다. coupled=true가 되면 _layout 가드가 홈으로 보냄.
  useEffect(() => {
    const POLL_MS = 4000;
    const id = setInterval(() => {
      // 이미 연결됐으면 더 폴링하지 않음(가드가 곧 이동시킴).
      if (useAuthStore.getState().coupled) {
        clearInterval(id);
        return;
      }
      void useAuthStore.getState().bootstrap();
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  async function onCopy() {
    if (!myCode) return;
    await Clipboard.setStringAsync(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function onLogout() {
    const ok = await confirmAsync('로그아웃', '정말 로그아웃할까요?', '로그아웃', true);
    if (ok) logout();
  }

  async function onConnect() {
    const code = partnerCode.trim();
    if (!code) return;
    setError(null);
    setConnecting(true);
    try {
      await connect(code);
      // 연결되면 _layout 가드가 홈으로 이동시킴.
    } catch (e) {
      setError(e instanceof ApiException ? e.message : '연결에 실패했어요. 코드를 확인해 주세요.');
    } finally {
      setConnecting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.container}>
          <Text style={styles.title}>커플 연결</Text>
          <Text style={styles.subtitle}>서로의 코드를 교환하면 일기가 이어져요</Text>

          <Card style={{ marginTop: spacing.xl }}>
            <Text style={styles.cardLabel}>내 초대코드</Text>
            {inviteLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : myCode ? (
              <Pressable onPress={onCopy} style={styles.codeBox}>
                <Text style={styles.code}>{myCode}</Text>
                <View style={styles.copyHintRow}>
                  {copied ? <Icon name="checkmark" size={14} color={colors.primary} /> : null}
                  <Text style={styles.copyHint}>{copied ? '복사됨' : '탭하여 복사'}</Text>
                </View>
              </Pressable>
            ) : (
              <Text style={styles.error}>코드를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</Text>
            )}
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.cardLabel}>상대 코드 입력</Text>
            <TextInput
              value={partnerCode}
              onChangeText={setPartnerCode}
              placeholder="상대에게 받은 코드"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="characters"
              style={styles.input}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label="연결하기"
              onPress={onConnect}
              disabled={partnerCode.trim().length === 0}
              loading={connecting}
              style={{ marginTop: spacing.lg }}
            />
          </Card>

          <Pressable onPress={onLogout} style={{ marginTop: spacing.xl, alignSelf: 'center' }}>
            <Text style={styles.logout}>로그아웃</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  title: { ...font.h1, color: colors.primary },
  subtitle: { ...font.body, color: colors.subText, marginTop: spacing.sm },
  cardLabel: { ...font.label, marginBottom: spacing.md },
  codeBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.coralSofter,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  code: { fontSize: 26, fontWeight: '800', letterSpacing: 3, color: colors.text },
  copyHintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  copyHint: { ...font.caption, color: colors.primary },
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
  logout: { ...font.caption, color: colors.subText, textDecorationLine: 'underline' },
});
