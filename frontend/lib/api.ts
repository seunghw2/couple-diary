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
};

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
};

export type DevLoginResponse = { accessToken: string; user: UserSummary };

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
};

/** 한 사람이 쓴 일기 본문 (OPEN 상태). */
export type EntryView = {
  id: number;
  authorId: number;
  rating?: number; // 별점 1~5
  mood?: string; // 이모지
  locationName?: string;
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

/** 작성 요청 (UpsertEntryRequest). 요청은 photoSeeds(응답만 photos). */
export type UpsertEntryRequest = {
  mode: EntryMode;
  templateType?: string;
  questionIds?: number[];
  answers: AnswerView[];
  photoSeeds: string[];
  locationName?: string;
  rating?: number;
  mood?: string;
};

// ─────────────────────────── 도메인 API ───────────────────────────

export const authApi = {
  devLogin: (email: string, nickname: string) =>
    api.post<DevLoginResponse>('/api/auth/dev-login', { email, nickname }, false),
  me: () => api.get<MeResponse>('/api/me'),
  updateMe: (patch: Partial<Pick<UserSummary, 'nickname' | 'avatarColor' | 'birthday'>>) =>
    api.patch<UserSummary>('/api/me', patch),
};

export const coupleApi = {
  get: () => api.get<CoupleResponse>('/api/couple'),
  invite: () => api.post<{ inviteCode: string }>('/api/couple/invite'),
  connect: (inviteCode: string) => api.post<CoupleResponse>('/api/couple/connect', { inviteCode }),
  setAnniversary: (anniversaryDate: string) =>
    api.put<CoupleResponse>('/api/couple/anniversary', { anniversaryDate }),
};

export const questionApi = {
  list: () => api.get<QuestionResponse[]>('/api/questions'),
};

export const entryApi = {
  month: (year: number, month: number) =>
    api.get<MonthEntrySummary[]>(`/api/entries?year=${year}&month=${month}`),
  detail: (date: string) => api.get<DayDetail>(`/api/entries/${date}`),
  create: (date: string, payload: UpsertEntryRequest) =>
    api.post<DayDetail>(`/api/entries/${date}`, payload),
  comments: (date: string) => api.get<CommentView[]>(`/api/entries/${date}/comments`),
  addComment: (date: string, text: string) =>
    api.post<CommentView>(`/api/entries/${date}/comments`, { text }),
};
