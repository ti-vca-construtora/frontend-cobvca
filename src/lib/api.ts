const BASE_URL = (import.meta.env?.VITE_API_URL as string | undefined) ?? "http://localhost:3000/api";

const TOKEN_KEY = "auth_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, params, headers: extraHeaders, ...rest } = options;

  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (qs) url += `?${qs}`;
  }

  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extraHeaders ?? {}),
  };

  const response = await fetch(url, {
    ...rest,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    const message =
      (data as { message?: string })?.message ??
      `Erro ${response.status}: ${response.statusText}`;
    throw new ApiError(response.status, message, data);
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, params?: RequestOptions["params"]) =>
    request<T>(path, { method: "GET", params }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }),

  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),

  postForm: <T>(path: string, formData: FormData) => {
    const token = getToken();
    return fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
        let data: unknown;
        try { data = await response.json(); } catch { data = null; }
        const message = (data as { message?: string })?.message ?? `Erro ${response.status}`;
        throw new ApiError(response.status, message, data);
      }
      return response.json() as Promise<T>;
    });
  },
};
