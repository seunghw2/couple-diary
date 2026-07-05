import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { bugReportApi, uploadPhoto } from '../lib/api';
import { API_URL } from '../lib/config';
import { showAlert } from '../lib/dialog';
import { useAuthStore } from '../store/useAuthStore';
import { colors, font, radius, shadow, spacing, useColors } from '../theme/theme';

const FAB_SIZE = 56;
const MARGIN = 16;
const MAX_IMAGES = 3;

/**
 * 전 화면 공통 플로팅 피드백 버튼.
 * - 루트 레이아웃에 오버레이로 올려 모든 화면 위에 뜬다(authenticated 한정).
 * - 우측 하단 고정(드래그 이동 없음). 탭하면 작성 모달을 연다.
 */
export function BugReportFab() {
  const status = useAuthStore((s) => s.status);
  const insets = useSafeAreaInsets();
  const c = useColors();
  const [modalOpen, setModalOpen] = useState(false);

  // 로그인 상태에서만 노출(리포터 식별 필요).
  if (status !== 'authenticated') return null;

  // 탭바 위로 살짝 띄워 고정. (하단 safe-area + 탭바 높이 여유)
  const bottom = MARGIN + Math.max(insets.bottom, 8) + 64;

  return (
    <>
      <Pressable
        onPress={() => setModalOpen(true)}
        style={[styles.fab, shadow, { backgroundColor: c.primary, right: MARGIN, bottom }]}
        hitSlop={8}
      >
        <Ionicons name="bulb" size={26} color={colors.white} />
      </Pressable>

      <BugReportModal visible={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

/** 버그/기능 제안 작성 모달. 둘 중 최소 하나 작성해야 제출. 이미지 최대 3장. */
function BugReportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const [bugText, setBugText] = useState('');
  const [wishText, setWishText] = useState('');
  const [images, setImages] = useState<string[]>([]); // 업로드된 상대경로(/files/xxx)
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 열릴 때마다 입력 초기화.
  useEffect(() => {
    if (visible) {
      setBugText('');
      setWishText('');
      setImages([]);
      setError(null);
    }
  }, [visible]);

  const canSubmit = bugText.trim().length > 0 || wishText.trim().length > 0;

  /** 갤러리에서 이미지 선택 → 업로드 → 목록에 추가(최대 3장). */
  async function pickImage() {
    if (images.length >= MAX_IMAGES || uploading) return;
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          showAlert('사진 접근 권한이 필요해요', '설정에서 사진 접근을 허용해 주세요.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      setUploading(true);
      const { url } = await uploadPhoto({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });
      setImages((prev) => [...prev, url].slice(0, MAX_IMAGES));
      setError(null);
    } catch {
      setError('이미지 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
  }

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
        imageUrls: images.length ? images : undefined,
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

            {/* 이미지 첨부(최대 3장) */}
            <Text style={[styles.label, { marginTop: spacing.lg }]}>
              사진 첨부 <Text style={styles.countHint}>({images.length}/{MAX_IMAGES})</Text>
            </Text>
            <View style={styles.thumbRow}>
              {images.map((url) => (
                <View key={url} style={styles.thumbWrap}>
                  <Image
                    source={{ uri: url.startsWith('http') ? url : `${API_URL}${url}` }}
                    style={styles.thumb}
                  />
                  <Pressable style={styles.thumbRemove} onPress={() => removeImage(url)} hitSlop={6}>
                    <Ionicons name="close" size={14} color={colors.white} />
                  </Pressable>
                </View>
              ))}
              {images.length < MAX_IMAGES ? (
                <Pressable style={styles.addThumb} onPress={pickImage} disabled={uploading}>
                  <Ionicons
                    name={uploading ? 'hourglass-outline' : 'camera-outline'}
                    size={22}
                    color={c.primary}
                  />
                </Pressable>
              ) : null}
            </View>

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
  countHint: { ...font.caption, color: colors.subText },
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
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  thumbWrap: { width: 72, height: 72 },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.border },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
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
