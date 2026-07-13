import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Notification, NotificationType } from '../lib/api';
import { timeAgo } from '../lib/date';
import { useNotifStore } from '../store/useNotifStore';
import { Icon } from '../components/ui';
import { colors, font, radius, spacing, useColors } from '../theme/theme';

/** type별 Ionicons 아이콘. */
const NOTIF_ICON: Record<NotificationType, React.ComponentProps<typeof Ionicons>['name']> = {
  PARTNER_WROTE: 'create-outline',
  ENTRY_OPENED: 'mail-open-outline',
  COMMENT: 'chatbubble-ellipses-outline',
  POKE: 'hand-left-outline',
  ANNIVERSARY: 'gift-outline',
  COUPLE_CONNECTED: 'heart',
  WORLDCUP_COMPLETED: 'trophy-outline',
  WORLDCUP_COMPARABLE: 'trophy',
  SAJU_BIRTHDAY_REQUEST: 'sparkles-outline',
  SAJU_COMPATIBILITY_READY: 'sparkles-outline',
};

export default function NotificationsScreen() {
  const router = useRouter();
  const c = useColors();
  const { items, unreadCount, loading, fetch, markRead, markAllRead } = useNotifStore();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void fetch();
    }, [fetch])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetch();
    setRefreshing(false);
  }, [fetch]);

  async function onTap(n: Notification) {
    if (!n.read) void markRead(n.id);
    if (n.type === 'WORLDCUP_COMPLETED' || n.type === 'WORLDCUP_COMPARABLE') {
      // 해당 월드컵 결과 비교로 바로.
      if (n.refKey) router.push({ pathname: '/worldcup/[key]', params: { key: n.refKey, compare: '1' } });
      else router.push('/worldcup');
    } else if (n.type === 'SAJU_BIRTHDAY_REQUEST' || n.type === 'SAJU_COMPATIBILITY_READY') {
      router.push('/saju/couple');
    } else if (n.entryDate) {
      router.push({ pathname: '/entry/[date]', params: { date: n.entryDate } });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={styles.title}>알림</Text>
        {unreadCount > 0 ? (
          <Pressable onPress={() => void markAllRead()} hitSlop={8}>
            <Text style={[styles.readAll, { color: c.primary }]}>모두 읽음</Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
          }
        >
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="notifications-outline" size={44} color={colors.coralSoft} />
              <Text style={styles.emptyTitle}>아직 알림이 없어요</Text>
              <Text style={styles.emptySub}>둘이 일기를 주고받으면 여기에 소식이 쌓여요</Text>
            </View>
          ) : (
            items.map((n) => <NotifRow key={n.id} notif={n} onPress={() => onTap(n)} />)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function NotifRow({ notif, onPress }: { notif: Notification; onPress: () => void }) {
  const c = useColors();
  const iconName = NOTIF_ICON[notif.type] ?? 'notifications-outline';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !notif.read && styles.rowUnread, pressed && { opacity: 0.7 }]}
    >
      {/* 미읽음 좌측 코럴 점 */}
      <View style={styles.dotCol}>{!notif.read ? <View style={[styles.dot, { backgroundColor: c.primary }]} /> : null}</View>
      <View style={styles.iconWrap}>
        <Icon name={iconName} size={20} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{notif.title}</Text>
        {notif.body ? <Text style={styles.rowBody}>{notif.body}</Text> : null}
        <Text style={styles.rowTime}>{timeAgo(notif.createdAt)}</Text>
      </View>
    </Pressable>
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
  title: { ...font.h2 },
  readAll: { ...font.label, color: colors.primary, width: 60, textAlign: 'right' },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  rowUnread: { backgroundColor: '#FFF3E4' },
  dotCol: { width: 10, alignItems: 'center', paddingTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.coralSofter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...font.title, fontWeight: '700' },
  rowBody: { ...font.body, color: colors.subText, marginTop: 2 },
  rowTime: { ...font.caption, color: colors.subText, marginTop: 4 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl * 3, gap: spacing.sm },
  emptyTitle: { ...font.title, marginTop: spacing.sm },
  emptySub: { ...font.caption, textAlign: 'center' },
});
