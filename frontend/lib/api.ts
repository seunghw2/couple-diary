import { API_URL } from './config';
import { tokenStore } from './tokenStore';

export type ApiErrorBody = { code?: string; message?: string; details?: Record<string, string> };

export class ApiException extends Error {
  status: number;
  body: ApiErrorBody;
  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? '요청에 실패했어요');
    this.status = status;
    this.body = body;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type RequestOpts = { method?: Method; body?: unknown; auth?: boolean };

// ── 401 전역 처리: 순환의존 없이 _layout에서 핸들러 등록 ──
let unauthorizedHandler: (() => void) | null = null;

/** 401 응답 시 호출될 콜백 등록 (앱 루트에서 로그아웃 처리용). */
export function setOnUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

async function handleUnauthorized() {
  await tokenStore.clear();
  unauthorizedHandler?.();
}

async function request<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await tokenStore.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth) {
    // 토큰 만료/무효 → 세션 정리 후 로그인으로 복귀
    await handleUnauthorized();
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? safeJson(text) : undefined;

  if (!res.ok) {
    throw new ApiException(res.status, (data as ApiErrorBody) ?? { message: '요청 실패' });
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

/** JSON 헬퍼. */
export const api = {
  get: <T>(path: string, auth = true) => request<T>(path, { method: 'GET', auth }),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: 'POST', body, auth }),
  patch: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: 'PATCH', body, auth }),
  put: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: 'PUT', body, auth }),
  del: <T = void>(path: string, auth = true, body?: unknown) =>
    request<T>(path, { method: 'DELETE', body, auth }),
};

// ─────────────────────────── 사진 업로드 (multipart) ───────────────────────────

export type PickedImage = { uri: string; fileName?: string | null; mimeType?: string | null };

/**
 * POST /api/photos — multipart/form-data(field: `file`)로 업로드.
 * 응답: { url: "/files/xxx.jpg" } (상대경로).
 * 웹(blob:/data: uri)은 blob으로 변환해 append, 네이티브는 {uri,name,type} 객체.
 */
export async function uploadPhoto(image: PickedImage): Promise<{ url: string }> {
  const token = await tokenStore.getToken();
  const name = image.fileName ?? `photo-${Date.now()}.jpg`;
  const type = image.mimeType ?? 'image/jpeg';

  const form = new FormData();
  if (image.uri.startsWith('blob:') || image.uri.startsWith('data:')) {
    const blob = await (await fetch(image.uri)).blob();
    (form as unknown as { append(k: string, v: unknown, n?: string): void }).append('file', blob, name);
  } else {
    form.append('file', { uri: image.uri, name, type } as unknown as Blob);
  }

  const res = await fetch(`${API_URL}/api/photos`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  if (res.status === 401) await handleUnauthorized();
  if (!res.ok) throw new ApiException(res.status, { message: '사진 업로드에 실패했어요' });
  return (await res.json()) as { url: string };
}

// ─────────────────────────── 타입 (백엔드 계약) ───────────────────────────
// JSON은 jackson non_null → null 필드는 아예 생략됨. 그래서 전부 optional.

/** 내 계정 요약 (GET/PATCH /api/me, 로그인 응답). profileImage 없음. */
export type UserSummary = {
  id: number;
  email: string;
  nickname: string;
  avatarColor: string;
  birthday?: string; // YYYY-MM-DD
  inviteCode: string;
};

/** 상대 요약. */
export type PartnerSummary = {
  id: number;
  nickname: string;
  avatarColor: string;
  birthday?: string; // YYYY-MM-DD
};

export type DevLoginResponse = { accessToken: string; user: UserSummary };
/** dev/kakao 로그인 공통 응답 형태. */
export type AuthResponse = { accessToken: string; user: UserSummary };

/** GET /api/me 래퍼. */
export type MeResponse = {
  user: UserSummary;
  coupled: boolean;
  coupleId?: number;
  partner?: PartnerSummary;
};

/** GET/PUT/connect 커플 응답. user1=커플 생성자, user2=상대. */
export type CoupleResponse = {
  id: number;
  user1: PartnerSummary;
  user2: PartnerSummary;
  anniversaryDate?: string; // YYYY-MM-DD
  ddayCount?: number;
};

export type QuestionType = 'NORMAL' | 'INLINE_BLANK';

export type QuestionResponse = {
  id: number;
  orderNo: number;
  text: string;
  type: QuestionType;
};

export type EntryStatus = 'EMPTY' | 'LOCKED' | 'OPEN';

/** 캘린더 그리드용 월 요약 (GET /api/entries?year=&month=). */
export type MonthEntrySummary = {
  date: string; // YYYY-MM-DD
  status: EntryStatus;
  photoCount: number;
  thumbSeed?: string;
  mineWritten: boolean;
  partnerWritten: boolean;
};

export type EntryMode = 'TEMPLATE' | 'QUESTION_PICK';

export type AnswerView = {
  questionId?: number;
  promptKey?: string;
  text: string;
};

export type PhotoView = {
  id: number;
  colorSeed: string;
  /** 실제 업로드된 이미지 상대경로(/files/...). 없으면 colorSeed 그라데이션 폴백. */
  url?: string;
};

/** 한 사람이 쓴 일기 본문 (OPEN 상태). */
export type EntryView = {
  id: number;
  authorId: number;
  rating?: number; // 별점 1~5
  mood?: string; // 이모지
  locationName?: string; // locations[0]와 동일(하위호환)
  locations?: string[]; // 다중 장소
  locationPoints?: LocationPoint[]; // 좌표 메타(지도 재현, 하위호환: 없을 수 있음)
  answers: AnswerView[];
  photos: PhotoView[];
  createdAt: string;
  editableAfter: string;
  editable: boolean;
};

/** 상대 일기가 아직 안 열렸을 때. */
export type LockedEntryView = { locked: true };

/** partnerEntry가 잠금 상태인지 판별. */
export function isLocked(v: EntryView | LockedEntryView | undefined): v is LockedEntryView {
  return !!v && (v as LockedEntryView).locked === true;
}

export type CommentView = {
  id: number;
  authorId: number;
  authorNickname?: string;
  text: string;
  createdAt: string;
};

/** 일기 상세 (GET/POST /api/entries/{date}). */
export type DayDetail = {
  date: string;
  status: EntryStatus;
  mode: EntryMode;
  templateType?: string;
  questions: QuestionResponse[];
  myEntry?: EntryView;
  partnerEntry?: EntryView | LockedEntryView;
  comments: CommentView[];
};

/** 작성 요청 (UpsertEntryRequest). 사진은 업로드 후 photoUrls로 전송. */
export type UpsertEntryRequest = {
  mode: EntryMode;
  templateType?: string;
  questionIds?: number[];
  answers: AnswerView[];
  photoSeeds?: string[];
  photoUrls?: string[];
  locations?: string[]; // 다중 장소
  locationPoints?: LocationPoint[]; // 좌표 메타(선택)
  rating?: number;
  mood?: string;
};

// ─────────────────────────── 도메인 API ───────────────────────────

export const authApi = {
  devLogin: (nickname: string) =>
    api.post<DevLoginResponse>('/api/auth/dev-login', { nickname }, false),
  /**
   * 카카오 로그인. 기본 경로는 서버 콜백이 앱으로 token을 되돌려주므로(lib/kakaoAuth) 이 호출이 필요없지만,
   * 프론트가 code를 직접 받는 대안 플로우를 위해 code→JWT 교환 엔드포인트를 노출한다.
   */
  kakaoLogin: (code: string, redirectUri: string) =>
    api.post<AuthResponse>('/api/auth/kakao', { code, redirectUri }, false),
  /** Apple 로그인. 프론트가 받은 identityToken(+최초 1회 이름)을 서버가 검증해 우리 JWT로 교환. */
  appleLogin: (identityToken: string, fullName?: string | null) =>
    api.post<AuthResponse>('/api/auth/apple', { identityToken, fullName }, false),
  me: () => api.get<MeResponse>('/api/me'),
  updateMe: (patch: Partial<Pick<UserSummary, 'nickname' | 'avatarColor' | 'birthday'>>) =>
    api.patch<UserSummary>('/api/me', patch),
  /** 계정 삭제 (앱스토어 필수). 내 계정과 커플·일기·편지 등 관련 데이터 전부 삭제. 204. */
  deleteAccount: () => api.del<void>('/api/me'),
};

/** 계산된 기념일 항목 (GET /api/couple/anniversaries). */
export type AnniversaryItem = {
  label: string;
  date: string; // YYYY-MM-DD
  dday: number; // 오늘 기준 남은 일수 (0=오늘)
};

export type AnniversaryListResponse = { items: AnniversaryItem[] };

export const coupleApi = {
  get: () => api.get<CoupleResponse>('/api/couple'),
  invite: () => api.post<{ inviteCode: string }>('/api/couple/invite'),
  connect: (inviteCode: string) => api.post<CoupleResponse>('/api/couple/connect', { inviteCode }),
  setAnniversary: (anniversaryDate: string) =>
    api.put<CoupleResponse>('/api/couple/anniversary', { anniversaryDate }),
  anniversaries: () => api.get<AnniversaryListResponse>('/api/couple/anniversaries'),
};

export const questionApi = {
  list: () => api.get<QuestionResponse[]>('/api/questions'),
};

// ─────────────────────────── 오늘의 질문 (편지함) ───────────────────────────
// 백엔드 계약: base path /api/questions. jackson non_null → null 필드는 생략, 전부 optional.
// (위 questionApi.list = 일기 작성용 질문 풀. 이 dailyQuestionApi = '오늘의 질문' 편지함 기능.)

/** 오늘의 질문 진행 상태. */
export type TodayQuestionState =
  | 'BEFORE_ARRIVAL' // 아직 도착 시간 전
  | 'NEEDS_CHOICE' // 봉투 2개 중 하나 골라야 함
  | 'NEEDS_ANSWER' // 질문 확정됨, 내 답장 필요
  | 'WAITING_PARTNER' // 내 답 봉인됨, 상대 대기
  | 'OPENED'; // 둘 다 답해 열림

/** 봉투(선택지) 한 장. */
export type QuestionChoice = { id: number; text: string; slot: number };

/** 확정된 오늘의 질문. */
export type DailyQuestion = { id: number; text: string };

/** 답장(내/상대 공통). sealed=봉인(내용 숨김). */
export type QuestionAnswer = {
  id: number;
  text?: string;
  sealed: boolean;
  /** 상대가 내 답에 하트를 눌렀는지 (myAnswer 쪽). */
  reactedByPartner?: boolean;
  /** 내가 상대 답에 하트를 눌렀는지 (partnerAnswer 쪽). */
  reactedByMe?: boolean;
};

/** GET /api/questions/today. */
export type TodayQuestion = {
  date: string; // YYYY-MM-DD
  state: TodayQuestionState;
  arrivalTime: string; // HH:mm
  coupled: boolean;
  choices?: QuestionChoice[];
  question?: DailyQuestion;
  chosenBy?: { id: number; nickname: string };
  chosenByMe?: boolean;
  myAnswer?: QuestionAnswer;
  /** 내 답장이 아직 수정 가능한가(봉인 후 24시간 이내). WAITING_PARTNER·OPENED에서만 옴. */
  myAnswerEditable?: boolean;
  partnerAnswer?: QuestionAnswer;
  partnerSealed?: boolean;
  /** OPENED에서만 옴 — 이 편지에 달린 댓글들. */
  comments?: CommentView[];
  streak: number;
  missedYesterday?: boolean;
};

/** GET /api/questions/archive 리스트 항목. */
export type ArchiveItem = {
  date: string; // YYYY-MM-DD
  questionText: string;
  opened: boolean;
  chosenByNickname?: string;
};

/** GET /api/questions/archive. */
export type ArchiveResponse = {
  items: ArchiveItem[];
  nextCursor?: string;
  totalOpened: number;
  streak: number;
  milestone?: string;
};

/** GET /api/questions/archive/{date}. */
export type ArchiveDetail = {
  date: string; // YYYY-MM-DD
  questionText: string;
  chosenBy?: { id: number; nickname: string };
  opened: boolean;
  myAnswer?: { text?: string; sealed: boolean };
  partnerAnswer?: { text?: string; sealed: boolean };
  partnerNickname?: string;
  /** opened면 이 편지에 달린 댓글들. */
  comments?: CommentView[];
};

/** GET/PUT /api/questions/settings. */
export type QuestionSettings = {
  notifyOn: boolean;
  arrivalTime: string; // HH:mm
  showStreak: boolean;
  milestoneOn: boolean;
};

export const dailyQuestionApi = {
  today: () => api.get<TodayQuestion>('/api/questions/daily/today'),
  choose: (questionId: number) =>
    api.post<TodayQuestion>('/api/questions/daily/today/choose', { questionId }),
  answer: (text: string) => api.post<TodayQuestion>('/api/questions/daily/today/answer', { text }),
  /** 오늘 열린 편지(또는 date 지정)에 댓글 달기. */
  comment: (text: string, date?: string) =>
    api.post<CommentView>('/api/questions/daily/comment', { date, text }),
  /** 상대 답장에 하트 토글. 백엔드가 단일 POST로 토글(추가/해제), 204 반환. */
  react: (answerId: number) =>
    api.post<void>(`/api/questions/daily/answers/${answerId}/react`),
  /** '이 질문 별로예요' 신고. 해당 봉투(선택지)를 덜 보여주도록 요청. */
  report: (questionId: number) => api.post<void>(`/api/questions/daily/${questionId}/report`),
  archive: (cursor?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit != null) params.set('limit', String(limit));
    const qs = params.toString();
    return api.get<ArchiveResponse>(`/api/questions/daily/archive${qs ? `?${qs}` : ''}`);
  },
  archiveDetail: (date: string) => api.get<ArchiveDetail>(`/api/questions/daily/archive/${date}`),
  getSettings: () => api.get<QuestionSettings>('/api/questions/daily/settings'),
  updateSettings: (patch: QuestionSettings) =>
    api.put<QuestionSettings>('/api/questions/daily/settings', patch),
};

/** 이전에 쓴 장소 추천 목록. */
/** 장소별 방문 일수(지도 핀 뱃지용). */
export type LocationCount = { name: string; count: number };
/** 장소 별명(커플별). */
export type LocationNickname = { name: string; nickname: string };
/** 장소 상세의 한 항목(그곳에 갔던 날). */
export type PlaceEntryItem = {
  date: string; // YYYY-MM-DD
  thumbUrl?: string; // 대표 사진 상대경로
  snippet?: string; // 일기 한 줄 미리보기
  mineWritten: boolean;
  partnerWritten: boolean;
};
/** 장소 상세(별명 + 그곳에 갔던 날 일기 모음). */
export type PlaceDetail = {
  name: string;
  nickname?: string;
  count: number;
  entries: PlaceEntryItem[];
};

export const locationApi = {
  list: () =>
    api.get<{ locations: string[]; counts?: LocationCount[]; nicknames?: LocationNickname[] }>(
      '/api/locations'
    ),
  /** 장소 상세 — 별명 + 그곳에 갔던 날짜별 일기 목록. */
  detail: (name: string) =>
    api.get<PlaceDetail>(`/api/locations/detail?name=${encodeURIComponent(name)}`),
  /** 장소 별명 저장(빈 문자열이면 삭제). */
  setNickname: (name: string, nickname: string) =>
    api.put<void>('/api/locations/nickname', { name, nickname }),
};

/** 커플이 캘린더에 콕 찍어둔 날(기념일 등). 그날 일기를 쓰면 표시는 숨고 하트만 남음. */
export type CalendarMark = { date: string; label?: string };

export const calendarMarkApi = {
  list: () => api.get<{ marks: CalendarMark[] }>('/api/calendar-marks'),
  add: (date: string, label?: string) => api.post<void>('/api/calendar-marks', { date, label }),
  remove: (date: string) => api.del<void>(`/api/calendar-marks/${date}`),
};

/** 카카오 로컬 키워드 검색 결과(백엔드 프록시). x->lng, y->lat 통과. */
export type PlaceResult = { name: string; address: string; category?: string; lat?: number; lng?: number };

/** 지도 재현용 장소 좌표 메타(작성/저장/조회 공통). name으로 locations와 매칭. */
export type LocationPoint = { name: string; lat: number; lng: number; category?: string };

/** 작성화면에서 다루는 선택 장소(이름-only 하위호환 + 좌표/수동입력 여부). */
export type SelectedPlace = {
  name: string;
  address?: string;
  category?: string;
  lat?: number;
  lng?: number;
  /** 지도 롱프레스로 직접 찍은 곳. */
  manual?: boolean;
};

export const placeApi = {
  search: (query: string) =>
    api.get<{ places: PlaceResult[] }>(`/api/places?query=${encodeURIComponent(query)}`),
};

// ─────────────────────────── 알림 (인앱) ───────────────────────────

export type NotificationType =
  | 'PARTNER_WROTE'
  | 'ENTRY_OPENED'
  | 'COMMENT'
  | 'POKE'
  | 'ANNIVERSARY'
  | 'COUPLE_CONNECTED'
  | 'WORLDCUP_COMPLETED'
  | 'WORLDCUP_COMPARABLE'
  | 'SAJU_BIRTHDAY_REQUEST'
  | 'SAJU_COMPATIBILITY_READY';

export type Notification = {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  entryDate?: string; // YYYY-MM-DD
  refKey?: string; // 딥링크 참조(예: 월드컵 key)
  read: boolean;
  createdAt: string;
};

export type NotificationListResponse = {
  items: Notification[];
  unreadCount: number;
};

export const notificationApi = {
  list: () => api.get<NotificationListResponse>('/api/notifications'),
  read: (id: number) => api.post<void>(`/api/notifications/${id}/read`),
  readAll: () => api.post<void>('/api/notifications/read-all'),
  /** 콕 찌르기. 미연결 400, 1시간 dedup. */
  poke: () => api.post<void>('/api/poke'),
};

// ─────────────────────────── 원격 푸시 토큰 ───────────────────────────

export const pushApi = {
  /** Expo 푸시 토큰 등록(로그인 후). platform = ios|android. */
  register: (token: string, platform: string) =>
    api.post<void>('/api/push-tokens', { token, platform }),
  /** 로그아웃 시 이 기기 토큰 해제(best-effort). */
  unregister: (token: string) => api.del<void>('/api/push-tokens', true, { token }),
};

export const entryApi = {
  month: (year: number, month: number) =>
    api.get<MonthEntrySummary[]>(`/api/entries?year=${year}&month=${month}`),
  detail: (date: string) => api.get<DayDetail>(`/api/entries/${date}`),
  create: (date: string, payload: UpsertEntryRequest) =>
    api.post<DayDetail>(`/api/entries/${date}`, payload),
  remove: (date: string) => api.del(`/api/entries/${date}`),
  /** 일기 날짜 이동. 성공 시 이동된 날짜의 상세 반환. */
  move: (date: string, targetDate: string) =>
    api.put<DayDetail>(`/api/entries/${date}/move`, { targetDate }),
  comments: (date: string) => api.get<CommentView[]>(`/api/entries/${date}/comments`),
  addComment: (date: string, text: string) =>
    api.post<CommentView>(`/api/entries/${date}/comments`, { text }),
};

// ─────────────────────────── 월드컵 미니게임 ───────────────────────────

export type WorldcupItem = { id: number; label: string; emoji: string };

export type WorldcupSummary = {
  key: string;
  title: string;
  emoji: string;
  size: number; // 강수(참가 수)
  myPlayed: boolean;
  partnerPlayed: boolean;
};

export type WorldcupDetail = {
  key: string;
  title: string;
  emoji: string;
  size: number;
  items: WorldcupItem[];
};

export type WorldcupRecord = { id: number; winner: WorldcupItem; playedAt: string };

/** 한 라운드(우승/결승/4강/…)에 놓인 아이템들. stage=1 우승 … 32 첫판 탈락. */
export type WorldcupStageGroup = { stage: number; stageName: string; items: WorldcupItem[] };

/** 한 사람의 전체 여정. */
export type WorldcupJourney = { winner: WorldcupItem; stages: WorldcupStageGroup[] };

export type WorldcupCompare = {
  me: WorldcupJourney;
  partner: WorldcupJourney;
  partnerNickname: string;
  sameWinner: boolean;
  matchRate: number; // 8강 이상 겹침 기반 취향 일치율(%)
  sharedTop8: WorldcupItem[];
};

export type WorldcupRecords = {
  key: string;
  title: string;
  myRecords: WorldcupRecord[];
  compare?: WorldcupCompare;
};

/** stages: 라운드사이즈 → 그 라운드에서 탈락한 아이템 id들. {1:[우승],2:[결승],4:[..],...} */
export type WorldcupStages = Record<number, number[]>;

export const worldcupApi = {
  list: () => api.get<WorldcupSummary[]>('/api/worldcups'),
  detail: (key: string) => api.get<WorldcupDetail>(`/api/worldcups/${key}`),
  saveResult: (key: string, winnerId: number, stages: WorldcupStages) =>
    api.post<void>(`/api/worldcups/${key}/result`, { winnerId, stages }),
  records: (key: string) => api.get<WorldcupRecords>(`/api/worldcups/${key}/records`),
  /** 설정 배지용 — 아직 안 본 상대 완주 수. */
  unseen: () => api.get<{ count: number }>('/api/worldcups/unseen'),
  /** 월드컵 목록 열람 → 배지 초기화. */
  markSeen: () => api.post<void>('/api/worldcups/seen'),
};

// ─────────────────────────── 사주 궁합 미니게임 ───────────────────────────
// JSON은 jackson non_null → null 필드는 생략, 전부 optional로 취급.

/** GET /api/saju/hub — 허브 진입 시 상태 게이팅용. */
export type SajuHub = {
  hasMyBirthday: boolean;
  hasPartner: boolean;
  hasPartnerBirthday: boolean;
  myName?: string;
  myBirthday?: string; // YYYY-MM-DD
  myBirthTime?: number; // 생시(지지 시작시각). 모름이면 생략.
  partnerName?: string;
  partnerBirthday?: string; // YYYY-MM-DD
  partnerBirthTime?: number;
};

/** 오늘의 기운. */
export type SajuDaily = {
  fortune: string;
  colorName: string;
  colorHex: string;
  keyword: string;
  coupleTip: string;
};

/** 오행 한 줄. level: 0 부족 · 1 적당 · 2 강함. */
export type SajuOhaeng = {
  elem: number;
  name: string;
  emoji: string;
  count: number;
  level: number;
  comment: string;
};

/** GET /api/saju/me — 내 사주. hasBirthday=false면 나머지 비어있을 수 있음. */
export type SajuPersonal = {
  hasBirthday: boolean;
  dayMasterName: string;
  dayMasterEmoji: string;
  dayMasterKo: string;
  dayMasterHanja: string;
  oneLine: string;
  desc: string;
  keywords: string[];
  growth: string;
  strengths: string[];
  growthPoints: string[];
  zodiac: string;
  pillars: string[]; // 년월일[시]
  ohaeng: SajuOhaeng[];
  daily: SajuDaily;
  hasHour: boolean;
  disclaimer: string;
};

/** 궁합 카테고리 한 줄. grade별로 색조를 달리한다. */
export type SajuCoupleCategory = {
  key: string;
  name: string;
  score: number; // 0~100
  grade: number;
  comment: string;
};

/** GET /api/saju/couple — 궁합. canCompute=false면 blockReason만 유효. */
export type SajuCouple = {
  canCompute: boolean;
  blockReason?: string;
  canRequestBirthday: boolean;
  percent: number;
  categories: SajuCoupleCategory[];
  totalComment: string;
  badges: string[];
  relComment: string;
  strongestKey: string;
  meName: string;
  meEmoji: string;
  partnerNickname: string;
  partnerName: string;
  partnerEmoji: string;
  tips: string[];
  hasHour: boolean;
  disclaimer: string;
};

export const sajuApi = {
  hub: () => api.get<SajuHub>('/api/saju/hub'),
  me: () => api.get<SajuPersonal>('/api/saju/me'),
  daily: () => api.get<SajuDaily>('/api/saju/daily'),
  /** 생시 설정. null=모름. 204. */
  setBirthTime: (hour: number | null) => api.put<void>('/api/saju/birth-time', { hour }),
  couple: () => api.get<SajuCouple>('/api/saju/couple'),
  /** 상대에게 생일 등록 요청 알림. 204. */
  requestBirthday: () => api.post<void>('/api/saju/request-birthday'),
  /** 설정 배지용 — 아직 안 본 사주 소식 수. */
  unseen: () => api.get<{ count: number }>('/api/saju/unseen'),
  /** 사주 허브 열람 → 배지 초기화. 204. */
  markSeen: () => api.post<void>('/api/saju/seen'),
};
