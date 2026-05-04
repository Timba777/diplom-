// ============================================================
// API — учёт личных финансов (Express backend)
// ============================================================

const BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

const TOKEN_KEY = "token";

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function getErrorMessage(err: unknown, fallback = "Произошла ошибка"): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function statusMessage(status: number, fallback: string): string {
  const messages: Record<number, string> = {
    400: "Некорректный запрос",
    401: "Требуется авторизация",
    403: "Доступ запрещён",
    404: "Не найдено",
    409: "Конфликт данных",
    500: "Ошибка сервера",
  };
  return messages[status] ?? fallback;
}

function messageFromBody(data: unknown): string | undefined {
  if (data && typeof data === "object" && "message" in data) {
    const m = (data as { message?: unknown }).message;
    return typeof m === "string" ? m : undefined;
  }
  return undefined;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  opts?: { skipAuthRedirect?: boolean },
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  const body = options.body;
  if (body !== undefined && body !== null && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { raw: text };
    }
  }

  if (res.status === 401 && !opts?.skipAuthRedirect) {
    removeToken();
    window.location.href = "/login";
    throw new ApiError(
      messageFromBody(data) ?? "Unauthorized",
      401,
      data,
    );
  }

  if (!res.ok) {
    const msg =
      messageFromBody(data) ??
      statusMessage(res.status, `Ошибка ${res.status}`);
    throw new ApiError(msg, res.status, data);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return data as T;
}

// ---- Auth ---------------------------------------------------

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

/** Ответ POST /auth/register — без токена */
export interface RegisterResponse {
  id: number;
  email: string;
  name: string;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const data = await request<AuthResponse>(
    "/auth/login",
    { method: "POST", body: JSON.stringify(payload) },
    { skipAuthRedirect: true },
  );
  setToken(data.token);
  return data;
}

export async function register(
  payload: RegisterPayload,
): Promise<RegisterResponse> {
  return request<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout() {
  removeToken();
  window.location.href = "/login";
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export { BASE_URL as API_BASE_URL };

// ---- Types (совместимость с JSON backend: числа) ------------

export type Id = number | string;

export interface Operation {
  id: Id;
  amount: string | number;
  type: "INCOME" | "EXPENSE";
  description?: string | null;
  date: string;
  planned: boolean;
  categoryId?: number | null;
  familyId?: number | null;
  userId?: number;
  category?: Category;
  family?: Family;
}

export interface Category {
  id: Id;
  name: string;
  type: "INCOME" | "EXPENSE";
  color?: string | null;
  icon?: string | null;
}

export interface Family {
  id: Id;
  name: string;
  description?: string | null;
  createdAt?: string;
  members?: FamilyMember[];
}

export interface FamilyMember {
  id: Id;
  userId: Id;
  role: "OWNER" | "MEMBER" | "VIEWER";
  user?: { id: number; name: string; email: string };
}

export interface BudgetLimit {
  id: Id;
  name: string;
  amount: string | number;
  period: "WEEKLY" | "MONTHLY";
  scope: "TOTAL" | "CATEGORY";
  isBlocking: boolean;
  categoryId?: number | null;
  userId?: number | null;
  familyId?: number | null;
  createdAt?: string;
  category?: { id: number; name: string };
  family?: { id: number; name: string };
}

/** @deprecated алиас для совместимости */
export type Limit = BudgetLimit;

export interface AnalyticsSummary {
  totalIncome: string;
  totalExpense: string;
  balance: string;
  operationsCount: number;
  unplannedExpensesCount: number;
  unplannedExpensesTotal: string;
}

export interface CategoryAnalyticsRow {
  categoryId: number | null;
  categoryName: string | null;
  totalAmount: string;
  operationsCount: number;
}

export interface PeriodBucket {
  period: string;
  totalAmount: string;
  operationsCount: number;
}

export interface ByPeriodResponse {
  groupBy: "day" | "week" | "month";
  type: "INCOME" | "EXPENSE";
  periods: PeriodBucket[];
}

export interface UnplannedAnalytics {
  totalUnplannedAmount: string;
  totalUnplannedCount: number;
  recentUnplanned: Array<{
    id: number;
    amount: string;
    date: string;
    description?: string | null;
    categoryId?: number | null;
  }>;
}

export interface FamilyAnalyticsResponse {
  familyId: number;
  totalIncome: string;
  totalExpense: string;
  balance: string;
  operationsCount: number;
  unplannedExpensesCount: number;
  unplannedExpensesTotal: string;
  expensesByCategory: Array<{
    categoryId: number | null;
    categoryName: string | null;
    totalAmount: string;
    operationsCount: number;
  }>;
}

// ---- Operations ---------------------------------------------

export async function getOperations(params?: {
  familyId?: string | number;
}): Promise<Operation[]> {
  const query = new URLSearchParams();
  if (params?.familyId !== undefined && params?.familyId !== "")
    query.set("familyId", String(params.familyId));
  const qs = query.toString();
  return request<Operation[]>(`/operations${qs ? `?${qs}` : ""}`);
}

export interface CreateOperationPayload {
  amount: number | string;
  type: "INCOME" | "EXPENSE";
  description?: string;
  date?: string;
  categoryId?: number | string | "";
  planned?: boolean;
  familyId?: number | string | "";
  force?: boolean;
}

export type CreateOperationResponse = Operation & {
  warning?: string;
  limitExceeded?: boolean;
  blocking?: boolean;
  unplannedPurchase?: boolean;
  blockedByLimit?: boolean;
  limit?: unknown;
  currentSpent?: string;
  attemptedAmount?: string;
  allowedRemaining?: string;
};

export async function createOperation(
  payload: CreateOperationPayload,
): Promise<CreateOperationResponse> {
  const body: Record<string, unknown> = {
    amount: payload.amount,
    type: payload.type,
    planned: payload.planned ?? false,
  };
  if (payload.description) body.description = payload.description;
  if (payload.date) body.date = payload.date;
  if (payload.categoryId !== undefined && payload.categoryId !== "")
    body.categoryId = Number(payload.categoryId);
  if (payload.familyId !== undefined && payload.familyId !== "")
    body.familyId = Number(payload.familyId);
  if (payload.force) body.force = true;

  const token = getToken();
  const res = await fetch(`${BASE_URL}/operations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { raw: text };
    }
  }

  if (res.status === 409) {
    const msg =
      messageFromBody(data) ?? "Limit exceeded";
    throw new ApiError(msg, 409, data);
  }

  if (res.status === 401) {
    removeToken();
    window.location.href = "/login";
    throw new ApiError("Unauthorized", 401, data);
  }

  if (!res.ok) {
    throw new ApiError(
      messageFromBody(data) ?? statusMessage(res.status, `Ошибка ${res.status}`),
      res.status,
      data,
    );
  }

  return data as CreateOperationResponse;
}

export async function deleteOperation(
  id: Id,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/operations/${id}`, {
    method: "DELETE",
  });
}

// ---- Categories ---------------------------------------------

export async function getCategories(): Promise<Category[]> {
  return request<Category[]>("/categories");
}

export async function createCategory(payload: {
  name: string;
  type: "INCOME" | "EXPENSE";
  color?: string;
  icon?: string;
  familyId?: number;
}): Promise<Category> {
  return request<Category>("/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCategory(
  id: Id,
  payload: Partial<{
    name: string;
    type: "INCOME" | "EXPENSE";
    color: string | null;
    icon: string | null;
    familyId: number | null;
  }>,
): Promise<Category> {
  return request<Category>(`/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCategory(id: Id): Promise<void> {
  await request<void>(`/categories/${id}`, { method: "DELETE" });
}

// ---- Families -----------------------------------------------

export async function getFamilies(): Promise<Family[]> {
  return request<Family[]>("/families");
}

export async function getFamily(id: Id): Promise<Family> {
  return request<Family>(`/families/${id}`);
}

export async function getFamilyMembers(id: Id): Promise<FamilyMember[]> {
  return request<FamilyMember[]>(`/families/${id}/members`);
}

export async function createFamily(payload: {
  name: string;
  description?: string;
}): Promise<Family> {
  return request<Family>("/families", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function addFamilyMember(
  familyId: Id,
  payload: { email: string; role?: "OWNER" | "MEMBER" | "VIEWER" },
): Promise<FamilyMember> {
  return request<FamilyMember>(`/families/${familyId}/members`, {
    method: "POST",
    body: JSON.stringify({
      email: payload.email,
      role: payload.role ?? "MEMBER",
    }),
  });
}

export async function updateFamilyMember(
  familyId: Id,
  memberId: Id,
  payload: { role: "OWNER" | "MEMBER" | "VIEWER" },
): Promise<FamilyMember> {
  return request<FamilyMember>(
    `/families/${familyId}/members/${memberId}`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

export async function removeFamilyMember(
  familyId: Id,
  memberId: Id,
): Promise<void> {
  await request<void>(`/families/${familyId}/members/${memberId}`, {
    method: "DELETE",
  });
}

export async function deleteFamily(id: Id): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/families/${id}`, {
    method: "DELETE",
  });
}

// ---- Limits -------------------------------------------------

export async function getLimits(): Promise<BudgetLimit[]> {
  return request<BudgetLimit[]>("/limits");
}

export async function createLimit(payload: {
  name: string;
  amount: number | string;
  period: "WEEKLY" | "MONTHLY";
  scope: "TOTAL" | "CATEGORY";
  isBlocking?: boolean;
  categoryId?: number | null;
  familyId?: number | null;
}): Promise<BudgetLimit> {
  const body: Record<string, unknown> = {
    name: payload.name,
    amount: String(payload.amount),
    period: payload.period,
    scope: payload.scope,
    isBlocking: payload.isBlocking ?? false,
  };
  if (payload.scope === "CATEGORY" && payload.categoryId != null) {
    body.categoryId = payload.categoryId;
  }
  if (payload.familyId != null && payload.familyId !== 0) {
    body.familyId = payload.familyId;
  }

  return request<BudgetLimit>("/limits", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateLimit(
  id: Id,
  payload: Partial<{
    name: string;
    amount: number | string;
    period: "WEEKLY" | "MONTHLY";
    scope: "TOTAL" | "CATEGORY";
    isBlocking: boolean;
    categoryId: number | null;
    familyId: number | null;
  }>,
): Promise<BudgetLimit> {
  const body: Record<string, unknown> = { ...payload };
  if (payload.amount !== undefined)
    body.amount = String(payload.amount);
  return request<BudgetLimit>(`/limits/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteLimit(id: Id): Promise<void> {
  await request<void>(`/limits/${id}`, { method: "DELETE" });
}

// ---- Analytics ----------------------------------------------

function qs(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function getAnalyticsSummary(
  params?: { dateFrom?: string; dateTo?: string },
): Promise<AnalyticsSummary> {
  return request<AnalyticsSummary>(
    `/analytics/summary${qs({
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
    })}`,
  );
}

export async function getAnalyticsByCategory(
  params?: { type?: "INCOME" | "EXPENSE"; dateFrom?: string; dateTo?: string },
): Promise<CategoryAnalyticsRow[]> {
  const type = params?.type ?? "EXPENSE";
  return request<CategoryAnalyticsRow[]>(
    `/analytics/by-category${qs({
      type,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
    })}`,
  );
}

export async function getAnalyticsByPeriod(
  params: {
    groupBy: "day" | "week" | "month";
    type: "INCOME" | "EXPENSE";
    dateFrom?: string;
    dateTo?: string;
  },
): Promise<ByPeriodResponse> {
  return request<ByPeriodResponse>(
    `/analytics/by-period${qs({
      groupBy: params.groupBy,
      type: params.type,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    })}`,
  );
}

export async function getAnalyticsUnplanned(
  params?: { dateFrom?: string; dateTo?: string },
): Promise<UnplannedAnalytics> {
  return request<UnplannedAnalytics>(
    `/analytics/unplanned${qs({
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
    })}`,
  );
}

export async function getFamilyAnalytics(
  familyId: Id,
  params?: { dateFrom?: string; dateTo?: string },
): Promise<FamilyAnalyticsResponse> {
  return request<FamilyAnalyticsResponse>(
    `/analytics/family/${familyId}${qs({
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
    })}`,
  );
}
