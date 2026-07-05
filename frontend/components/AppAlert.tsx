import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAlertStore, type AlertButton } from '../store/useAlertStore';
import { colors, font, radius, shadow, spacing, useColors } from '../theme/theme';

/**
 * 앱 톤 커스텀 알림(전역). iOS 기본 회색 Alert 대신 코럴&크림 카드로 표시.
 * useAlertStore를 구독하며, 버튼 1개=단순 알림, 2개=확인/취소, 3개 이상=세로 배열.
 */
export function AppAlert() {
  const c = useColors();
  const { visible, config, close } = useAlertStore();

  if (!config) return null;
  const buttons: AlertButton[] = config.buttons.length
    ? config.buttons
    : [{ text: '확인', style: 'default' }];

  const press = (btn: AlertButton) => {
    close();
    btn.onPress?.();
  };

  // 하드웨어 back / 요청 닫기 → 취소 버튼이 있으면 그걸로 처리(프로미스 resolve 보장).
  const onDismiss = () => {
    const cancel = buttons.find((b) => b.style === 'cancel');
    press(cancel ?? buttons[buttons.length - 1]);
  };

  const vertical = buttons.length > 2;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{config.title}</Text>
          {config.message ? <Text style={styles.message}>{config.message}</Text> : null}

          <View style={[styles.actions, vertical && styles.actionsCol]}>
            {buttons.map((b, i) => {
              const cancel = b.style === 'cancel';
              const destructive = b.style === 'destructive';
              return (
                <Pressable
                  key={`${b.text}-${i}`}
                  onPress={() => press(b)}
                  style={({ pressed }) => [
                    styles.btn,
                    vertical && styles.btnFull,
                    cancel
                      ? styles.btnCancel
                      : { backgroundColor: destructive ? colors.danger : c.primary },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[styles.btnText, cancel ? styles.btnTextCancel : styles.btnTextPrimary]}>
                    {b.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(50, 35, 30, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow,
  },
  title: { ...font.h2, textAlign: 'center' },
  message: {
    ...font.body,
    color: colors.subText,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  actionsCol: { flexDirection: 'column' },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  btnFull: { flex: 0, width: '100%' },
  btnCancel: { backgroundColor: colors.coralSofter },
  btnText: { ...font.body, fontWeight: '700' },
  btnTextPrimary: { color: colors.white },
  btnTextCancel: { color: colors.text },
});
