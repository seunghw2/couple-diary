import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { useCoupleStore } from '../../store/useCoupleStore';
import { Button, Card } from '../../components/ui';
import { colors, font, radius, spacing } from '../../theme/theme';

export default function SettingsScreen() {
  const { user, partner, logout } = useAuthStore();
  const { couple, setAnniversary } = useCoupleStore();
  const [anniv, setAnniv] = useState(couple?.anniversaryDate ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSaveAnniv() {
    const v = anniv.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      setMsg('YYYY-MM-DD 형식으로 입력해 주세요.');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await setAnniversary(v);
      setMsg('저장했어요 ✓');
    } catch {
      setMsg('저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  }

  function confirmLogout() {
    if (Platform.OS === 'web') {
      logout();
      return;
    }
    Alert.alert('로그아웃', '정말 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => logout() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>설정 ⚙️</Text>

        <Card style={{ marginTop: spacing.xl }}>
          <Text style={styles.label}>내 정보</Text>
          <Text style={styles.value}>{user?.nickname ?? '-'}</Text>
          <Text style={styles.sub}>{user?.email ?? ''}</Text>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={styles.label}>상대</Text>
          <Text style={styles.value}>{partner?.nickname ?? '연결 대기 중'}</Text>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={styles.label}>기념일 (D-day 기준)</Text>
          <TextInput
            value={anniv}
            onChangeText={setAnniv}
            placeholder="2025-01-01"
            placeholderTextColor={colors.border}
            autoCapitalize="none"
            style={styles.input}
          />
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          <Button label="기념일 저장" variant="soft" onPress={onSaveAnniv} loading={saving} style={{ marginTop: spacing.md }} />
        </Card>

        <Pressable onPress={confirmLogout} style={{ marginTop: spacing.xxl, alignSelf: 'center' }}>
          <Text style={styles.logout}>로그아웃</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  title: { ...font.h1 },
  label: { ...font.label, marginBottom: spacing.xs },
  value: { ...font.title },
  sub: { ...font.caption, marginTop: 2 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 48,
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.sm,
  },
  msg: { ...font.caption, color: colors.primary, marginTop: spacing.sm },
  logout: { ...font.body, color: colors.danger, textDecorationLine: 'underline' },
});
