import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { feedbackApi } from '../lib/api';
import { showAlert, showToast } from '../lib/dialog';
import { errorMessage } from '../lib/errors';
import { colors, font, radius, shadow, spacing } from '../theme/theme';

const MAX = 2000;

/**
 * 화면 하단에 얹는 은은한 '의견 보내기' 푸터 링크(A안).
 * 탭하면 팝업이 떠서 자유 의견을 입력·전송한다.
 * @param source 어느 화면에서 보냈는지(맥락용, 백엔드 저장).
 */
export function FeedbackLink({ source }: { source?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const close = () => {
    if (sending) return;
    setOpen(false);
  };

  const submit = async () => {
    const content = text.trim();
    if (!content) {
      showToast('내용을 입력해 주세요.');
      return;
    }
    setSending(true);
    try {
      await feedbackApi.send(content, source);
      setSending(false);
      setOpen(false);
      setText('');
      showToast('소중한 의견 고마워요. 잘 살펴볼게요 💌');
    } catch (e) {
      setSending(false);
      showAlert('전송하지 못했어요', errorMessage(e));
    }
  };

  return (
    <View style={styles.footer}>
      <Text style={styles.hint}>아쉬운 점이나 아이디어가 있다면{'\n'}소중한 의견을 보내주세요.</Text>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => pressed && { opacity: 0.6 }}
      >
        <Text style={styles.link}>의견 보내기 ›</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <View style={styles.card}>
            <Text style={styles.title}>의견 보내기</Text>
            <Text style={styles.sub}>편하게 남겨 주세요. 하나하나 잘 읽고 반영할게요.</Text>

            <TextInput
              style={styles.input}
              value={text}
              onChangeText={(t) => setText(t.slice(0, MAX))}
              placeholder="아쉬운 점, 바라는 점, 아이디어 무엇이든 좋아요."
              placeholderTextColor={colors.placeholder}
              multiline
              textAlignVertical="top"
              autoFocus
              editable={!sending}
            />
            <Text style={styles.count}>{text.length}/{MAX}</Text>

            <View style={styles.actions}>
              <Pressable
                onPress={close}
                disabled={sending}
                style={({ pressed }) => [styles.btn, styles.btnCancel, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.btnCancelText}>취소</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={sending}
                style={({ pressed }) => [styles.btn, styles.btnSend, pressed && { opacity: 0.85 }]}
              >
                {sending ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.btnSendText}>보내기</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', paddingVertical: spacing.xl },
  hint: {
    ...font.body,
    fontSize: 14.5,
    color: colors.subText,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.9,
  },
  link: {
    marginTop: spacing.md,
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
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
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow,
  },
  title: { ...font.h2, textAlign: 'center' },
  sub: {
    ...font.caption,
    color: colors.subText,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  input: {
    minHeight: 120,
    maxHeight: 220,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...font.body,
    color: colors.text,
  },
  count: {
    ...font.caption,
    color: colors.placeholder,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: { backgroundColor: colors.coralSofter },
  btnCancelText: { ...font.body, fontWeight: '700', color: colors.text },
  btnSend: { backgroundColor: colors.primary },
  btnSendText: { ...font.body, fontWeight: '700', color: colors.white },
});
