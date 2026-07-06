/**
 * 기념일/생일을 '매년 반복'으로 계산하는 유틸.
 * 커플 기념일(사귄 날)과 두 사람의 생일은 해가 바뀌어도 같은 월/일에 다시 온다.
 * 캘린더 하이라이트(홈)와 일기 상세 상단 배지에서 공용으로 쓴다.
 */
import { pad2, parseISO } from './date';

export type SpecialKind = 'anniversary' | 'birthday';

export type SpecialDay = {
  kind: SpecialKind;
  /** 화면에 보여줄 라벨. 예: "2주년", "지민 생일", "기념일" */
  label: string;
  /** 라벨 앞에 붙일 이모지 없는 아이콘 이름(Ionicons). */
  icon: 'heart' | 'gift';
};

export type SpecialSource = {
  anniversaryDate?: string | null;
  myBirthday?: string | null;
  myName?: string | null;
  partnerBirthday?: string | null;
  partnerName?: string | null;
};

/** month=0~11, day=1~31. 2/29 생일은 평년엔 2/28로 맞춰 매년 표시되게 한다. */
function matchesMonthDay(target: Date, srcMonth: number, srcDay: number): boolean {
  if (target.getMonth() === srcMonth && target.getDate() === srcDay) return true;
  // 윤년 2/29 → 평년 2/28에 표시
  if (srcMonth === 1 && srcDay === 29 && target.getMonth() === 1 && target.getDate() === 28) {
    const y = target.getFullYear();
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    if (!isLeap) return true;
  }
  return false;
}

/** 특정 날짜(YYYY-MM-DD)가 기념일/생일이면 표시용 정보를 반환, 아니면 null. */
export function specialDayFor(targetDate: string, src: SpecialSource): SpecialDay | null {
  const t = parseISO(targetDate);

  // 1) 커플 기념일(매년) → 만난 해 이후로는 "N주년", 당해/이전엔 "기념일"
  if (src.anniversaryDate) {
    const a = parseISO(src.anniversaryDate);
    if (matchesMonthDay(t, a.getMonth(), a.getDate())) {
      const years = t.getFullYear() - a.getFullYear();
      const label = years >= 1 ? `${years}주년` : '기념일';
      return { kind: 'anniversary', label, icon: 'heart' };
    }
  }

  // 2) 생일(매년) — 내 생일 먼저, 그다음 상대 생일
  if (src.myBirthday) {
    const b = parseISO(src.myBirthday);
    if (matchesMonthDay(t, b.getMonth(), b.getDate())) {
      return { kind: 'birthday', label: `${src.myName?.trim() || '내'} 생일`, icon: 'gift' };
    }
  }
  if (src.partnerBirthday) {
    const b = parseISO(src.partnerBirthday);
    if (matchesMonthDay(t, b.getMonth(), b.getDate())) {
      return { kind: 'birthday', label: `${src.partnerName?.trim() || '상대'} 생일`, icon: 'gift' };
    }
  }

  return null;
}

/**
 * 주어진 연/월(1~12)에서 기념일/생일에 해당하는 날짜(YYYY-MM-DD) → SpecialDay 맵.
 * 캘린더 그리드가 해당 월만 검사하면 되도록 미리 계산해 준다.
 */
export function specialDaysInMonth(
  year: number,
  month: number,
  src: SpecialSource
): Map<string, SpecialDay> {
  const out = new Map<string, SpecialDay>();
  if (!src.anniversaryDate && !src.myBirthday && !src.partnerBirthday) return out;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${pad2(month)}-${pad2(d)}`;
    const sp = specialDayFor(dateStr, src);
    if (sp) out.set(dateStr, sp);
  }
  return out;
}
