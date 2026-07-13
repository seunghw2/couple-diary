import { ReactNode, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { Icon } from './ui';
import { colors, font, spacing } from '../theme/theme';

// 구 아키텍처 Android에서 LayoutAnimation 활성화(신 아키텍처는 자동).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** 다음 레이아웃 변화를 부드럽게(접기/펼치기 공용). 새 의존성 없음. */
export function animateLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

/** 기본 접힌 섹션. 헤더 탭 → 펼침. (사주 근거 보기 등) */
export function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View>
      <Pressable
        onPress={() => {
          animateLayout();
          setOpen((v) => !v);
        }}
        style={styles.header}
        hitSlop={8}
      >
        <Text style={styles.title}>{title}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.subText} />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...font.title },
  body: { marginTop: spacing.md },
});
