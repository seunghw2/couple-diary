import { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Icon } from '../../components/ui';
import { colors, font, radius, spacing, useColors } from '../../theme/theme';

/** 앱 강조색 팔레트(뮤트 웜 12색). 탭하면 즉시 적용. */
const APP_COLORS = [
  '#FF8E72', '#FF9E80', '#F49BA0', '#E98A8A',
  '#E0A98F', '#D6A16A', '#E3B23C', '#A8B58F',
  '#8FB4A0', '#7FB0A8', '#9AB6C9', '#C29BB8',
] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const c = useColors();
  const user = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.partner);
  const appPrimary = useThemeStore((s) => s.appPrimary);
  const setAppPrimary = useThemeStore((s) => s.setAppPrimary);

  const initial = (user?.nickname ?? '?').trim().charAt(0) || '?';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>설정</Text>

        {/* 프로필 헤더 → 내 정보 */}
        <Pressable onPress={() => router.push('/account')} style={({ pressed }) => [pressed && styles.pressed]}>
          <View style={styles.profileCard}>
            <View style={[styles.avatar, { backgroundColor: user?.avatarColor ?? c.primary }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{user?.nickname ?? '나'}</Text>
              <Text style={styles.profileSub}>
                {partner?.nickname ? `${partner.nickname}님과 연결됨` : '내 정보 · 로그아웃'}
              </Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.subText} />
          </View>
        </Pressable>

        {/* 앱 컬러(간단 설정: 탭 즉시 적용) */}
        <Text style={styles.groupLabel}>앱 컬러</Text>
        <View style={styles.groupCard}>
          <View style={styles.colorCardBody}>
            <Text style={styles.colorHint}>내 기기의 앱 강조색이에요. 색을 누르면 바로 적용돼요.</Text>
            <View style={styles.swatchWrap}>
              {APP_COLORS.map((sw) => {
                const selected = appPrimary === sw;
                return (
                  <Pressable
                    key={sw}
                    onPress={() => setAppPrimary(sw)}
                    style={[
                      styles.swatch,
                      { backgroundColor: sw },
                      selected && [styles.swatchSelected, { borderColor: colors.text }],
                    ]}
                  >
                    {selected ? <Icon name="checkmark" size={16} color={colors.white} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* 링크 그룹 */}
        <Text style={styles.groupLabel}>더 보기</Text>
        <View style={styles.groupCard}>
          <SettingsRow
            icon="gift-outline"
            tint={c.primary}
            label="기념일 보기"
            onPress={() => router.push('/anniversaries')}
          />
          <Divider />
          <SettingsRow
            icon="bulb-outline"
            tint={c.primary}
            label="피드백"
            onPress={() => router.push('/bug-reports')}
            last
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** 애플 설정 스타일 행: 좌측 컬러 아이콘 + 라벨 + 우측 값/셰브런. */
function SettingsRow({
  icon,
  tint,
  label,
  value,
  onPress,
  last,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  tint: string;
  label: string;
  value?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && styles.pressed]}
    >
      <View style={[styles.rowIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={17} color={colors.white} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {typeof value === 'string' ? <Text style={styles.rowValue}>{value}</Text> : value}
        <Icon name="chevron-forward" size={18} color={colors.subText} />
      </View>
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl * 2 },
  title: { ...font.h1 },
  pressed: { opacity: 0.6 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 22, fontWeight: '800' },
  profileName: { ...font.h2 },
  profileSub: { ...font.caption, color: colors.subText, marginTop: 2 },

  groupLabel: { ...font.caption, color: colors.subText, marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: spacing.sm },
  groupCard: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  rowLast: {},
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { ...font.body, flex: 1, color: colors.text },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowValue: { ...font.body, color: colors.subText },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 56 },

  colorCardBody: { padding: spacing.lg },
  colorHint: { ...font.caption, color: colors.subText, marginBottom: spacing.md },
  swatchWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: { borderWidth: 3 },
});
