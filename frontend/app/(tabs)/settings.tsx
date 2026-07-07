import { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { Icon } from '../../components/ui';
import { colors, font, radius, spacing, useColors } from '../../theme/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const c = useColors();
  const user = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.partner);

  const initial = (user?.nickname ?? '?').trim().charAt(0) || '?';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: c.primary }]}>설정</Text>
          <Icon name="settings-sharp" size={19} color={c.primary} />
        </View>

        {/* 프로필 헤더 → 내 정보 */}
        <Pressable onPress={() => router.push('/account')} style={({ pressed }) => [pressed && styles.pressed]}>
          <View style={styles.profileCard}>
            <View style={[styles.avatar, { backgroundColor: c.primary }]}>
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

        {/* 바로가기 — 열어서 보거나 즐기는 것 */}
        <Text style={styles.groupLabel}>바로가기</Text>
        <View style={styles.groupCard}>
          <SettingsRow
            icon="gift-outline"
            tint={c.primary}
            label="기념일 보기"
            onPress={() => router.push('/anniversaries')}
          />
          <SettingsRow
            icon="trophy-outline"
            tint={c.primary}
            label="월드컵 게임"
            onPress={() => router.push('/worldcup')}
            last
          />
        </View>

        {/* 설정 — 값을 바꾸는 것 */}
        <Text style={styles.groupLabel}>설정</Text>
        <View style={styles.groupCard}>
          <SettingsRow
            icon="mail-outline"
            tint={c.primary}
            label="오늘의 질문 설정"
            onPress={() => router.push('/question/settings')}
          />
          <SettingsRow
            icon="color-palette-outline"
            tint={c.primary}
            label="앱 컬러 변경"
            value={<View style={[styles.colorDot, { backgroundColor: c.primary }]} />}
            onPress={() => router.push('/app-color')}
            last
          />
        </View>

        {/* 약관 · 정보 */}
        <Text style={styles.groupLabel}>약관 · 정보</Text>
        <View style={styles.groupCard}>
          <SettingsRow
            icon="lock-closed-outline"
            tint={c.primary}
            label="개인정보 처리방침"
            onPress={() => router.push('/legal/privacy')}
          />
          <SettingsRow
            icon="document-text-outline"
            tint={c.primary}
            label="이용약관"
            onPress={() => router.push('/legal/terms')}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl * 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontSize: 26, fontWeight: '800' },
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { ...font.body, flex: 1, color: colors.text },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowValue: { ...font.body, color: colors.subText },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.white,
  },
});
