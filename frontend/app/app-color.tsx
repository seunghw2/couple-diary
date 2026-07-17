import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { authApi } from '../lib/api';
import { Icon } from '../components/ui';
import { colors, font, radius, spacing, useColors } from '../theme/theme';

/** 앱 강조색 팔레트(뮤트 웜 25색). 탭하면 즉시 적용. */
const APP_COLORS = [
  '#FF8E72', '#FF9E80', '#FFB59E', '#F49BA0', '#EF7E7E',
  '#E98A8A', '#E0A98F', '#D6A16A', '#CBB994', '#E3B23C',
  '#C9A227', '#B0857A', '#A8B58F', '#8FB4A0', '#7FB0A8',
  '#6FA8A0', '#9AB6C9', '#7FA8C7', '#A99BC4', '#8E86C9',
  '#C29BB8', '#D98CA6', '#C98A8A', '#B98A9E', '#A68B7B',
] as const;

/** 앱 컬러 변경 — 설정에서 진입하는 별도 화면. */
export default function AppColorScreen() {
  const router = useRouter();
  const c = useColors();
  const appPrimary = useThemeStore((s) => s.appPrimary);
  const setAppPrimary = useThemeStore((s) => s.setAppPrimary);

  // 앱 컬러를 고르면 프로필 사진 배경색(avatarColor)도 같은 색으로 서버에 저장 →
  // 내 프로필은 물론 상대에게 보이는 내 프로필 배경도 이 색으로 통일된다.
  async function pickColor(hex: string) {
    setAppPrimary(hex);
    try {
      const u = await authApi.updateMe({ avatarColor: hex });
      useAuthStore.getState().setUser(u);
    } catch {
      // 색 동기화 실패해도 앱 테마는 이미 반영됨 — 조용히 무시.
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={[styles.topTitle, { color: c.primary }]}>앱 컬러</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.hint}>색을 누르면 앱 전체 강조색으로 바로 적용돼요.</Text>
        <View style={styles.swatchWrap}>
          {APP_COLORS.map((sw) => {
            const selected = appPrimary === sw;
            return (
              <Pressable
                key={sw}
                onPress={() => pickColor(sw)}
                style={[
                  styles.swatch,
                  { backgroundColor: sw },
                  selected && [styles.swatchSelected, { borderColor: colors.text }],
                ]}
              >
                {selected ? <Icon name="checkmark" size={20} color={colors.white} /> : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
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
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl * 2 },
  hint: { ...font.body, color: colors.subText, marginBottom: spacing.xl },
  swatchWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  swatch: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: { borderWidth: 3 },
});
