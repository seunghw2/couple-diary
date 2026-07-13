/** 생시(12지시) 옵션. hour = 각 지지 시작시각(정자시 규칙). 모름 = null. */
export const HOUR_OPTIONS: { hour: number; label: string; range: string }[] = [
  { hour: 23, label: '자', range: '23~01' },
  { hour: 1, label: '축', range: '01~03' },
  { hour: 3, label: '인', range: '03~05' },
  { hour: 5, label: '묘', range: '05~07' },
  { hour: 7, label: '진', range: '07~09' },
  { hour: 9, label: '사', range: '09~11' },
  { hour: 11, label: '오', range: '11~13' },
  { hour: 13, label: '미', range: '13~15' },
  { hour: 15, label: '신', range: '15~17' },
  { hour: 17, label: '유', range: '17~19' },
  { hour: 19, label: '술', range: '19~21' },
  { hour: 21, label: '해', range: '21~23' },
];

/** 저장된 hour → "자시 (23~01)" 라벨. undefined/null이면 '모름'. */
export function hourLabel(hour?: number | null): string {
  if (hour == null) return '모름';
  const o = HOUR_OPTIONS.find((h) => h.hour === hour);
  return o ? `${o.label}시 (${o.range})` : '모름';
}
