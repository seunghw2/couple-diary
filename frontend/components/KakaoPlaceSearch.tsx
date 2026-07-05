import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { placeApi, type PlaceResult } from '../lib/api';
import { Icon } from './ui';
import { colors, font, radius, shadow, spacing, useColors } from '../theme/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 결과를 선택하면 장소명을 넘김. */
  onSelect: (name: string) => void;
  /** 이미 추가된 장소(체크 표시용). */
  alreadyAdded?: string[];
};

/**
 * 카카오 로컬 키워드 검색 시트. 백엔드 프록시(/api/places)로 실제 상호명을 검색해
 * 탭하면 "다녀온 장소"에 추가. 일기 작성 화면에서 사용.
 */
export function KakaoPlaceSearch({ visible, onClose, onSelect, alreadyAdded = [] }: Props) {
  const c = useColors();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const seq = useRef(0);

  // 열릴 때 초기화
  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
      setSearched(false);
    }
  }, [visible]);

  // 디바운스 검색
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const my = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await placeApi.search(q);
        if (my !== seq.current) return; // 최신 검색만 반영
        setResults(res?.places ?? []);
      } catch {
        if (my === seq.current) setResults([]);
      } finally {
        if (my === seq.current) {
          setLoading(false);
          setSearched(true);
        }
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const addedSet = useMemo(() => new Set(alreadyAdded), [alreadyAdded]);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backTap} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>장소 검색</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Icon name="close" size={22} color={colors.subText} />
              </Pressable>
            </View>

            {/* 검색 입력 */}
            <View style={styles.searchBox}>
              <Icon name="search" size={18} color={colors.placeholder} />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="카카오맵에서 장소 검색 (예: 성수 대림창고)"
                placeholderTextColor={colors.placeholder}
                style={styles.searchInput}
                returnKeyType="search"
              />
              {loading ? <ActivityIndicator size="small" color={c.primary} /> : null}
              {query.length > 0 && !loading ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Icon name="close-circle" size={18} color={colors.placeholder} />
                </Pressable>
              ) : null}
            </View>

            {/* 결과 */}
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {!query.trim() ? (
                <Text style={styles.hint}>다녀온 곳을 검색해서 추가해요</Text>
              ) : searched && results.length === 0 && !loading ? (
                <Text style={styles.hint}>검색 결과가 없어요</Text>
              ) : (
                results.map((p, i) => {
                  const added = addedSet.has(p.name);
                  return (
                    <Pressable
                      key={`${p.name}-${i}`}
                      style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
                      onPress={() => {
                        if (!added) onSelect(p.name);
                        onClose();
                      }}
                    >
                      <View style={[styles.pin, { backgroundColor: c.coralSofter }]}>
                        <Icon name="location" size={16} color={c.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={styles.itemAddr} numberOfLines={1}>
                          {p.category ? `${p.category} · ` : ''}
                          {p.address}
                        </Text>
                      </View>
                      {added ? (
                        <Icon name="checkmark-circle" size={22} color={c.primary} />
                      ) : (
                        <Icon name="add-circle-outline" size={22} color={colors.subText} />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(50, 35, 30, 0.35)', justifyContent: 'flex-end' },
  backTap: { flex: 1 },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    height: '72%',
    ...shadow,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { ...font.h2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 48,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
  list: { marginTop: spacing.md },
  hint: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: spacing.xxl },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pin: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  itemName: { ...font.title },
  itemAddr: { ...font.caption, marginTop: 2 },
});
