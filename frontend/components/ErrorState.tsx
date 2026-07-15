import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Icon } from './ui';
import { colors, font, spacing } from '../theme/theme';

/** 에러 + 재시도 공용 상태(빈 상태와 구분해서 씀). onRetry 없으면 버튼 생략. */
export function ErrorState({
  message = '불러오지 못했어요',
  onRetry,
  icon = 'cloud-offline-outline',
}: {
  message?: string;
  onRetry?: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={styles.wrap}>
      <Icon name={icon} size={40} color={colors.coralSoft} />
      <Text style={styles.msg}>{message}</Text>
      {onRetry ? <Button label="다시 시도" variant="soft" icon="refresh" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  msg: { ...font.body, color: colors.subText, textAlign: 'center' },
});
