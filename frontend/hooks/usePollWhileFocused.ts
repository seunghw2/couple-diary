import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * 화면이 포커스된 동안에만 fn을 intervalMs 간격으로 실행(언포커스 시 정지).
 * fn은 ref로 최신값을 유지 → 리렌더마다 인터벌을 재설정하지 않음.
 * 댓글 등 상대 변경을 실시간처럼 반영하는 조용한 폴링에 사용.
 */
export function usePollWhileFocused(fn: () => void, intervalMs: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => fnRef.current(), intervalMs);
      return () => clearInterval(id);
    }, [intervalMs])
  );
}
