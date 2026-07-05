import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { bugReportApi } from '../lib/api';
import { showAlert } from '../lib/dialog';
import { useAuthStore } from '../store/useAuthStore';
import { colors, font, radius, shadow, spacing, useColors } from '../theme/theme';

const FAB_SIZE = 56;
const MARGIN = 12;
const TAP_SLOP = 8; // 이 이하로 움직이면 드래그가 아닌 탭으로 간주
const STORAGE_KEY = 'bugFabPosition';

/** 화면 경계 안으로 좌표 클램프. */
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * 전 화면 공통 플로팅 버그리포트 버튼.
 * - 루트 레이아웃에 오버레이로 올려 모든 화면 위에 뜬다(authenticated 한정).
 * - PanResponder + Animated로 드래그 이동, 경계 클램프, 위치는 AsyncStorage에 저장.
 * - 작게 움직이면 탭으로 간주해 작성 모달을 연다.
 */
export function BugReportFab() {
  const status = useAuthStore((s) => s.status);
  const c = useColors();

  const win = Dimensions.get('window');
  // 기본 위치: 우측 하단.
  const defaultPos = {
    x: win.width - FAB_SIZE - MARGIN,
    y: win.height - FAB_SIZE - MARGIN * 8,
  };

  const pan = useRef(new Animated.ValueXY(defaultPos)).current;
  const posRef = useRef(defaultPos); // 현재 확정 좌표(제스처 시작 기준)
  const [modalOpen, setModalOpen] = useState(false);

  // 저장된 위치 복원.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!alive || !raw) return;
        const saved = JSON.parse(raw) as { x: number; y: number };
        const w = Dimensions.get('window');
        const x = clamp(saved.x, MARGIN, w.width - FAB_SIZE - MARGIN);
        const y = clamp(saved.y, MARGIN, w.height - FAB_SIZE - MARGIN);
        posRef.current = { x, y };
        pan.setValue({ x, y });
      } catch {
        /* 무시: 기본 위치 사용 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [pan]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        // 제스처 시작점을 오프셋으로 잡고 값은 0에서 시작 → 부드러운 드래그.
        pan.setOffset(posRef.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_e, g) => {
        pan.flattenOffset();
        const w = Dimensions.get('window');
        const nx = clamp(posRef.current.x + g.dx, MARGIN, w.width - FAB_SIZE - MARGIN);
        const ny = clamp(posRef.current.y + g.dy, MARGIN, w.height - FAB_SIZE - MARGIN);
        posRef.current = { x: nx, y: ny };
        // 경계 밖으로 나갔으면 클램프 위치로 스냅.
        Animated.spring(pan, { toValue: { x: nx, y: ny }, useNativeDriver: false, friction: 7 }).start();
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(posRef.current));

        // 거의 안 움직였으면 탭 → 모달 오픈.
        if (Math.abs(g.dx) <= TAP_SLOP && Math.abs(g.dy) <= TAP_SLOP) {
          setModalOpen(true);
        }
      },
    })
  ).current;

  // 로그인 상태에서만 노출(리포터 식별 필요).
  if (status !== 'authenticated') return null;

  return (
    <>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.fab,
          shadow,
          { backgroundColor: c.primary, transform: pan.getTranslateTransform() },
        ]}
      >
        <Ionicons name="bulb" size={26} color={colors.white} />
      </Animated.View>

      <BugReportModal visible={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

/** 버그/기능 제안 작성 모달. 둘 중 최소 하나 작성해야 제출. */
function BugReportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const [bugText, setBugText] = useState('');
  const [wishText, setWishText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 열릴 때마다 입력 초기화.
  useEffect(() => {
    if (visible) {
      setBugText('');
      setWishText('');
      setError(null);
    }
  }, [visible]);

  const canSubmit = bugText.trim().length > 0 || wishText.trim().length > 0;

  async function onSubmit() {
    if (!canSubmit || submitting) {
      if (!canSubmit) setError('버그 또는 원하는 기능 중 하나는 작성해 주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await bugReportApi.create({
        bugText: bugText.trim() || undefined,
        wishText: wishText.trim() || undefined,
      });
      onClose();
      showAlert('고마워요', '소중한 의견이 잘 전달됐어요.');
    } catch {
      setError('전송에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIcon, { backgroundColor: c.coralSofter }]}>
                <Ionicons name="bulb" size={20} color={c.primary} />
              </View>
              <Text style={styles.title}>피드백 보내기</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.subText} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>어떤 기능이 안되나요?</Text>
            <TextInput
              value={bugText}
              onChangeText={(t) => {
                setBugText(t);
                setError(null);
              }}
              placeholder="겪은 문제나 버그를 알려 주세요"
              placeholderTextColor={colors.placeholder}
              multiline
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: spacing.lg }]}>어떤 기능이 있으면 좋겠나요?</Text>
            <TextInput
              value={wishText}
              onChangeText={(t) => {
                setWishText(t);
                setError(null);
              }}
              placeholder="바라는 기능을 자유롭게 적어 주세요"
              placeholderTextColor={colors.placeholder}
              multiline
              style={styles.input}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit || submitting}
            style={({ pressed }) => [
              styles.submit,
              { backgroundColor: c.primary },
              (!canSubmit || submitting) && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.submitText}>{submitting ? '보내는 중…' : '보내기'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(50, 35, 30, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...font.h2 },
  label: { ...font.label, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    minHeight: 84,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
  },
  error: { ...font.caption, color: colors.danger, marginTop: spacing.md },
  submit: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  submitText: { ...font.body, fontWeight: '700', color: colors.white },
});
