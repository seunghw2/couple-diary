/** YYYY-MM-DD (로컬 기준) 유틸. 서버 date는 전부 이 형식. */

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISO(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** anniversaryDate 기준 D-day. 기념일 당일 = D+1(만난 첫날 포함 관례). null이면 null. */
export function dDay(anniversaryDate: string | null | undefined): number | null {
  if (!anniversaryDate) return null;
  const start = parseISO(anniversaryDate);
  const now = new Date();
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  return diff + 1;
}

/** D-day 표기. 양수(과거 기념일)=D+n, 음수(미래 기념일)=D-n. */
export function formatDday(dday: number): string {
  return dday >= 0 ? `D+${dday}` : `D${dday}`;
}

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

export function weekdayKo(date: string): string {
  return WEEKDAYS_KO[parseISO(date).getDay()];
}

export function formatKoLong(date: string): string {
  const d = parseISO(date);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function formatKoShort(date: string): string {
  const d = parseISO(date);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** ISO 시각 → 상대시간("방금/n분 전/n시간 전/n일 전"). 미래/파싱실패는 "방금". */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return '방금';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  return `${day}일 전`;
}

/** 해당 연/월(1~12)의 캘린더 그리드를 앞뒤 빈칸 포함해 생성. */
export type CalendarCell = { date: string | null; day: number | null };

/**
 * 항상 6주(42칸) 고정 그리드. 달별 주 수(5/6)에 상관없이 높이가 일정하도록
 * 앞뒤를 빈칸으로 패딩한다. 빈칸(date:null)은 렌더 시 비표시.
 */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const startDow = first.getDay(); // 0=일
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < startDow; i++) cells.push({ date: null, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${year}-${pad2(month)}-${pad2(d)}`, day: d });
  }
  // 6주(42칸) 고정: 뒤쪽을 빈칸으로 채워 항상 같은 높이.
  while (cells.length < 42) cells.push({ date: null, day: null });
  return cells;
}
