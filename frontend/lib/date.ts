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

/** 해당 연/월(1~12)의 캘린더 그리드를 앞뒤 빈칸 포함해 생성. */
export type CalendarCell = { date: string | null; day: number | null };

export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const startDow = first.getDay(); // 0=일
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < startDow; i++) cells.push({ date: null, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${year}-${pad2(month)}-${pad2(d)}`, day: d });
  }
  // 마지막 주 채우기 (7의 배수)
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
  return cells;
}
