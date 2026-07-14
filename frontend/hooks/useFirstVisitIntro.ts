import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 최초 진입 인트로 게이트. AsyncStorage(key)로 최초 방문 판별.
 * - firstVisit: null=판별중 / true=최초 / false=재방문
 * - introTimeUp: 인트로 연출이 끝났는지
 * - finishIntro: 인트로 완료 콜백(재방문 처리 + 상태 해제)
 * 실제 로딩 게이트 표시 조합은 화면에서 데이터 상태와 함께 결정.
 */
export function useFirstVisitIntro(key: string) {
  const [firstVisit, setFirstVisit] = useState<boolean | null>(null);
  const [introTimeUp, setIntroTimeUp] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(key).then((v) => setFirstVisit(!v));
  }, [key]);

  const finishIntro = useCallback(async () => {
    await AsyncStorage.setItem(key, '1');
    setIntroTimeUp(true);
  }, [key]);

  return { firstVisit, introTimeUp, finishIntro };
}
