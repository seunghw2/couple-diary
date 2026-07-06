import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { QuestionSettings, dailyQuestionApi } from '../../lib/api';
import { showToast } from '../../lib/dialog';
import { Button, Card, Icon } from '../../components/ui';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';

/** "HH:mm" → {h, m}. 파싱 실패 시 09:00. */
function parseTime(v: string): { h: number; m: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return { h: 9, m: 0 };
  return { h: Math.min(23, Number(m[1])), m: Math.min(59, Number(m[2])) };
}
function fmtTime(h: number, m: number): string {
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${p(h)}:${p(m)}`;
}
/** "HH:mm" → "오전/오후 h시 mm분". */
function labelTime(v: string): string {
  const { h, m } = parseTime(v);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}시${m > 0 ? ` ${m}분` : ''}`;
}

/** 오늘의 질문 설정 (pushed). 알림/도착시간/스트릭/기념 토글. 저장 버튼으로 반영. */
export default function QuestionSettingsScreen() {
  const router = useRouter();
  const c = useColors();

  const [settings, setSettings] = useState<QuestionSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await dailyQuestionApi.getSettings();
      setSettings(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function patch(p: Partial<QuestionSettings>) {
    setSettings((prev) => (prev ? { ...prev, ...p } : prev));
  }

  async function onSave() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await dailyQuestionApi.updateSettings(settings);
      setSettings(res);
      showToast('설정을 저장했어요');
    } catch {
      showToast('저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={styles.topTitle}>질문 설정</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading && !settings ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} size="large" />
        </View>
      ) : error && !settings ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>설정을 불러오지 못했어요.</Text>
          <Button label="다시 시도" variant="soft" onPress={load} style={{ marginTop: spacing.lg }} />
        </View>
      ) : settings ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Card>
            <Row
              label="편지 알림"
              hint="새 편지가 도착하면 알려드려요"
              value={
                <Switch
                  value={settings.notifyOn}
                  onValueChange={(v) => patch({ notifyOn: v })}
                  trackColor={{ true: c.coralSoft, false: colors.border }}
                  thumbColor={colors.white}
                />
              }
            />
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.label}>편지 도착 시간</Text>
            <Pressable style={styles.dateField} onPress={() => setTimeOpen(true)}>
              <Text style={styles.dateText}>{labelTime(settings.arrivalTime)}</Text>
              <Icon name="time-outline" size={20} color={c.primary} />
            </Pressable>
            <Text style={styles.hint}>매일 이 시간에 새 질문 편지가 도착해요.</Text>
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <Row
              label="연속 일수 표시"
              hint="함께한 날들을 하트로 세어드려요"
              value={
                <Switch
                  value={settings.showStreak}
                  onValueChange={(v) => patch({ showStreak: v })}
                  trackColor={{ true: c.coralSoft, false: colors.border }}
                  thumbColor={colors.white}
                />
              }
            />
            <View style={styles.divider} />
            <Row
              label="소소한 기념 알림"
              hint="7일, 30일 같은 특별한 날을 축하해요"
              value={
                <Switch
                  value={settings.milestoneOn}
                  onValueChange={(v) => patch({ milestoneOn: v })}
                  trackColor={{ true: c.coralSoft, false: colors.border }}
                  thumbColor={colors.white}
                />
              }
            />
          </Card>

          <Text style={styles.midnightHint}>답장은 매일 자정에 마감돼요. 그때까지 답하면 편지가 열려요.</Text>

          <Button label="저장" onPress={onSave} loading={saving} style={{ marginTop: spacing.xl }} />
        </ScrollView>
      ) : null}

      <TimePickerSheet
        visible={timeOpen}
        value={settings?.arrivalTime ?? '09:00'}
        onClose={() => setTimeOpen(false)}
        onConfirm={(v) => {
          patch({ arrivalTime: v });
          setTimeOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function Row({ label, hint, value }: { label: string; hint?: string; value: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      {value}
    </View>
  );
}

/** 시/분 선택 하단 시트. 10분 단위 분 선택으로 간결하게. */
function TimePickerSheet({
  visible,
  value,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  value: string;
  onConfirm: (v: string) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const init = parseTime(value);
  const [h, setH] = useState(init.h);
  const [m, setM] = useState(init.m);

  // 열릴 때마다 현재 값으로 초기화.
  useEffect(() => {
    if (visible) {
      const p = parseTime(value);
      setH(p.h);
      setM(p.m);
    }
  }, [visible, value]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins = [0, 10, 20, 30, 40, 50];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, shadow]}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>도착 시간</Text>
          <Text style={[styles.sheetPreview, { color: c.primary }]}>{labelTime(fmtTime(h, m))}</Text>
        </View>

        <Text style={styles.sheetLabel}>시</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {hours.map((hh) => {
            const sel = hh === h;
            return (
              <Pressable
                key={hh}
                onPress={() => setH(hh)}
                style={[styles.chip, { borderColor: sel ? c.primary : colors.border }, sel && { backgroundColor: '#FFF3E4' }]}
              >
                <Text style={[styles.chipText, sel && { color: c.primary, fontWeight: '700' }]}>{hh}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.sheetLabel}>분</Text>
        <View style={styles.chipRow}>
          {mins.map((mm) => {
            const sel = mm === m;
            return (
              <Pressable
                key={mm}
                onPress={() => setM(mm)}
                style={[styles.chip, { borderColor: sel ? c.primary : colors.border }, sel && { backgroundColor: '#FFF3E4' }]}
              >
                <Text style={[styles.chipText, sel && { color: c.primary, fontWeight: '700' }]}>
                  {mm < 10 ? `0${mm}` : mm}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Button label="완료" onPress={() => onConfirm(fmtTime(h, m))} style={{ marginTop: spacing.xl }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  emptyText: { ...font.body, color: colors.subText, textAlign: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  topTitle: { ...font.h2 },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl * 2 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { ...font.title },
  rowHint: { ...font.caption, color: colors.subText, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },

  label: { ...font.label, marginBottom: spacing.xs },
  hint: { ...font.caption, color: colors.subText, marginTop: spacing.sm },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 48,
    marginTop: spacing.sm,
  },
  dateText: { fontSize: 16, color: colors.text },
  midnightHint: { ...font.caption, color: colors.subText, textAlign: 'center', marginTop: spacing.xl },

  // time sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxl * 1.5,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  sheetTitle: { ...font.h2 },
  sheetPreview: { ...font.title },
  sheetLabel: { ...font.label, marginTop: spacing.md, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', paddingRight: spacing.lg },
  chip: {
    minWidth: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  chipText: { fontSize: 16, color: colors.text },
});
