import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { authApi, SajuDaily, SajuHub, sajuApi } from '../../lib/api';
import { HOUR_OPTIONS, hourLabel } from '../../lib/sajuHours';
import { showToast } from '../../lib/dialog';
import { useAuthStore } from '../../store/useAuthStore';
import { DatePickerSheet } from '../../components/DatePickerSheet';
import { Icon } from '../../components/ui';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';

function fmtDate(d?: string) {
  return d ? d.replace(/-/g, '.') : '미입력';
}

/** 사주 궁합 허브 — 커플 정보 카드 + 내 사주 / 우리 궁합 + 오늘의 기운. */
export default function SajuHome() {
  const router = useRouter();
  const c = useColors();
  const setUser = useAuthStore((s) => s.setUser);
  const [hub, setHub] = useState<SajuHub | null>(null);
  const [daily, setDaily] = useState<SajuDaily | null>(null);
  const [error, setError] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showHour, setShowHour] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const [h, d] = await Promise.all([sajuApi.hub(), sajuApi.daily().catch(() => null)]);
      setHub(h);
      setDaily(d);
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      sajuApi.markSeen().catch(() => {});
    }, [load])
  );

  async function saveBirthday(date: string) {
    setShowDate(false);
    setSaving(true);
    try {
      const u = await authApi.updateMe({ birthday: date });
      setUser(u);
      await load();
    } catch {
      showToast('생일 저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  }

  async function saveHour(hour: number | null) {
    setShowHour(false);
    setSaving(true);
    try {
      await sajuApi.setBirthTime(hour);
      await load();
    } catch {
      showToast('생시 저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  }

  const meSub = !hub ? '' : !hub.hasMyBirthday ? '생일을 먼저 등록해요' : '일간·오행으로 보는 나';
  const partnerSub = !hub
    ? ''
    : !hub.hasPartner
      ? '상대와 연결되면 볼 수 있어요'
      : !hub.hasPartnerBirthday
        ? '상대 생일이 등록되면 볼 수 있어요'
        : `일간·오행으로 보는 ${hub.partnerName ?? '연인'}`;
  const coupleSub = !hub
    ? ''
    : !hub.hasPartner
      ? '상대와 연결되면 볼 수 있어요'
      : !hub.hasPartnerBirthday
        ? '상대 생일이 등록되면 볼 수 있어요'
        : '둘의 궁합 점수 보기';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={[styles.topTitle, { color: c.primary }]}>우리 사주 궁합</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sub}>재미로 보는 사주 🔮</Text>

        {hub == null && !error ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: spacing.xxl }} />
        ) : error ? (
          <Text style={styles.empty}>불러오지 못했어요.</Text>
        ) : (
          <>
            {/* 커플 정보 카드 (하트 커플 헤더) */}
            <View style={[styles.info, shadow]}>
              <View style={styles.cTop}>
                <View style={styles.cPerson}>
                  <View style={[styles.cAv, { backgroundColor: c.coralSofter }]}>
                    <Text style={styles.cAvText}>{hub?.myEmoji ?? '🙂'}</Text>
                  </View>
                  <Text style={styles.cNm}>{hub?.myName ?? '나'}</Text>
                  <Text style={styles.cRl}>나</Text>
                </View>
                <Text style={[styles.heart, { color: c.primary }]}>♥</Text>
                <View style={styles.cPerson}>
                  <View style={[styles.cAv, { backgroundColor: colors.partnerSoft }]}>
                    <Text style={styles.cAvText}>{hub?.partnerEmoji ?? '🙂'}</Text>
                  </View>
                  <Text style={styles.cNm}>{hub?.partnerName ?? '미연결'}</Text>
                  <Text style={styles.cRl}>연인</Text>
                </View>
              </View>

              <View style={styles.cInfoRow}>
                {/* 나 (편집 가능) */}
                <View style={styles.cBox}>
                  <Pressable onPress={() => setShowDate(true)} style={({ pressed }) => [styles.cLine, pressed && styles.pressed]}>
                    <Text style={styles.cK}>생일</Text>
                    <Text style={styles.cV}>{fmtDate(hub?.myBirthday)}</Text>
                    <Icon name="pencil" size={13} color={c.primary} />
                  </Pressable>
                  <Pressable onPress={() => setShowHour(true)} style={({ pressed }) => [styles.cLine, pressed && styles.pressed]}>
                    <Text style={styles.cK}>생시</Text>
                    <Text style={styles.cV}>{hourLabel(hub?.myBirthTime)}</Text>
                    <Icon name="pencil" size={13} color={c.primary} />
                  </Pressable>
                  {saving ? <ActivityIndicator size="small" color={c.primary} style={{ marginTop: 4 }} /> : null}
                </View>
                {/* 연인 (표시만) */}
                <View style={styles.cBox}>
                  <View style={styles.cLine}>
                    <Text style={styles.cK}>생일</Text>
                    <Text style={[styles.cV, styles.readonly]}>{fmtDate(hub?.partnerBirthday)}</Text>
                  </View>
                  <View style={styles.cLine}>
                    <Text style={styles.cK}>생시</Text>
                    <Text style={[styles.cV, styles.readonly]}>{hourLabel(hub?.partnerBirthTime)}</Text>
                  </View>
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => router.push('/saju/me')}
              style={({ pressed }) => [styles.card, shadow, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.emoji}>🌳</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>내 사주 보기</Text>
                <Text style={styles.cardSub}>{meSub}</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={colors.subText} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/saju/partner')}
              style={({ pressed }) => [styles.card, shadow, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.emoji}>🌸</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>연인 사주 보기</Text>
                <Text style={styles.cardSub}>{partnerSub}</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={colors.subText} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/saju/couple')}
              style={({ pressed }) => [styles.card, shadow, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.emoji}>💞</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>우리 궁합 보기</Text>
                <Text style={styles.cardSub}>{coupleSub}</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={colors.subText} />
            </Pressable>

            {daily ? (
              <View style={[styles.banner, { backgroundColor: c.coralSofter }]}>
                <View style={styles.bannerHead}>
                  <Text style={styles.bannerTitle}>오늘의 기운</Text>
                  <View style={[styles.colorDot, { backgroundColor: daily.colorHex }]} />
                  <Text style={styles.bannerColor}>{daily.colorName}</Text>
                </View>
                <Text style={styles.bannerFortune}>{daily.fortune}</Text>
                <Text style={styles.bannerKeyword}>키워드 · {daily.keyword}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* 생일 편집 */}
      <DatePickerSheet
        visible={showDate}
        value={hub?.myBirthday}
        title="생년월일"
        maxDate={new Date().toISOString().slice(0, 10)}
        onConfirm={saveBirthday}
        onClose={() => setShowDate(false)}
      />

      {/* 생시 편집 */}
      <Modal visible={showHour} transparent animationType="slide" onRequestClose={() => setShowHour(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowHour(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>태어난 시각</Text>
            <Text style={styles.sheetSub}>알면 시주까지 반영돼 더 정확해요.</Text>
            <View style={styles.hourGrid}>
              {HOUR_OPTIONS.map((o) => {
                const active = hub?.myBirthTime === o.hour;
                return (
                  <Pressable
                    key={o.hour}
                    onPress={() => saveHour(o.hour)}
                    style={[styles.hourCell, active && { backgroundColor: c.primary, borderColor: c.primary }]}
                  >
                    <Text style={[styles.hourLabel, active && { color: colors.white }]}>{o.label}시</Text>
                    <Text style={[styles.hourRange, active && { color: colors.white }]}>{o.range}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => saveHour(null)}
              style={[styles.unknown, hub?.myBirthTime == null && { borderColor: c.primary }]}
            >
              <Text style={[styles.unknownText, hub?.myBirthTime == null && { color: c.primary }]}>모름</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl * 2 },
  sub: { ...font.caption, color: colors.subText, marginBottom: spacing.lg },

  info: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  readonly: { color: colors.subText },
  pressed: { opacity: 0.55 },

  // 하트 커플 헤더
  cTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, marginBottom: spacing.xs },
  cPerson: { alignItems: 'center', width: 110 },
  cAv: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  cAvText: { fontSize: 28 },
  cNm: { ...font.title, fontWeight: '800', marginTop: 7, textAlign: 'center' },
  cRl: { ...font.caption, color: colors.subText, marginTop: 1 },
  heart: { fontSize: 22, marginTop: -18 },
  cInfoRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  cBox: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  cLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cK: { ...font.caption, color: colors.subText, width: 30 },
  cV: { ...font.body, fontWeight: '700', color: colors.text, flex: 1, fontSize: 14 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  emoji: { fontSize: 30 },
  cardTitle: { ...font.h2, fontSize: 17 },
  cardSub: { ...font.caption, color: colors.subText, marginTop: 3 },
  banner: { borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.sm },
  bannerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bannerTitle: { ...font.title, flex: 1 },
  colorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.white },
  bannerColor: { ...font.label, color: colors.text },
  bannerFortune: { ...font.body, color: colors.text, marginTop: spacing.sm, lineHeight: 21 },
  bannerKeyword: { ...font.caption, color: colors.subText, marginTop: spacing.sm },
  empty: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: spacing.xxl },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  sheetTitle: { ...font.h2 },
  sheetSub: { ...font.caption, color: colors.subText, marginTop: 4, marginBottom: spacing.lg },
  hourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hourCell: {
    width: '30.5%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  hourLabel: { ...font.body, fontWeight: '700' },
  hourRange: { ...font.caption, color: colors.subText, marginTop: 1 },
  unknown: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  unknownText: { ...font.body, fontWeight: '700', color: colors.text },
});
