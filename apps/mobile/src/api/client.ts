/**
 * The HTTP client. One transport for every platform: `fetch`. On native,
 * CapacitorHttp (capacitor.config.ts) patches window.fetch to run through the
 * OS HTTP stack, so the bundled origin meets no CORS; in the browser it is
 * plain fetch against the configured base. Tests and mock mode inject their
 * own transport.
 */

export type Transport = (url: string, init: RequestInit) => Promise<Response>;

export type ApiErrorKind = "network" | "timeout" | "http" | "unauthorized" | "parse";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status; 0 when no response arrived. */
  readonly status: number;
  /** The server's `error` string, when it sent one. */
  readonly serverMessage: string | null;

  constructor(kind: ApiErrorKind, status: number, message: string, serverMessage: string | null) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.serverMessage = serverMessage;
  }

  /** No answer from the server at all: offline, DNS, TLS, timeout. */
  get isOffline(): boolean {
    return this.kind === "network" || this.kind === "timeout";
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => string | null;
  /** Called once per 401 on an authenticated, non-auth endpoint. */
  onUnauthorized?: () => void;
  transport?: Transport;
  timeoutMs?: number;
}

export interface RequestOptions {
  signal?: AbortSignal;
  /** Send no Authorization header (public auth endpoints). */
  anonymous?: boolean;
  headers?: Record<string, string>;
}

/**
 * 401 on these means wrong credentials or a spent code, never an expired
 * session — they must not sign the user out (same list as the web client).
 */
const NO_SIGN_OUT_ON_401 = ["/api/auth/login", "/api/auth/register", "/api/auth/exchange-code"];

export interface ApiClient {
  readonly baseUrl: string;
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  del<T>(path: string, options?: RequestOptions): Promise<T>;
  /** Raw status + parsed JSON, for endpoints whose 2xx codes differ in meaning (202). */
  request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<{ status: number; data: T }>;
}

const DEFAULT_TIMEOUT_MS = 20_000;

function errorMessageOf(data: unknown): string | null {
  if (data && typeof data === "object" && "error" in data) {
    const value = (data as { error: unknown }).error;
    return typeof value === "string" ? value : null;
  }
  return null;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const transport: Transport = options.transport ?? ((url, init) => fetch(url, init));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    requestOptions: RequestOptions = {},
  ): Promise<{ status: number; data: T }> {
    if (!path.startsWith("/")) throw new Error(`API path must start with "/": ${path}`);
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...requestOptions.headers,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = requestOptions.anonymous ? null : options.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const outer = requestOptions.signal;
    const onOuterAbort = () => controller.abort();
    outer?.addEventListener("abort", onOuterAbort, { once: true });

    let res: Response;
    try {
      res = await transport(`${options.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (outer?.aborted) throw err;
      if (timedOut) throw new ApiError("timeout", 0, `Timed out: ${method} ${path}`, null);
      throw new ApiError("network", 0, `Network error: ${method} ${path}`, null);
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onOuterAbort);
    }

    let data: unknown = null;
    const text = res.status === 204 ? "" : await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        if (res.ok) throw new ApiError("parse", res.status, `Bad JSON from ${path}`, null);
      }
    }

    if (res.status === 401) {
      const isAuthCall = NO_SIGN_OUT_ON_401.some((p) => path.startsWith(p));
      if (token && !isAuthCall) options.onUnauthorized?.();
      throw new ApiError("unauthorized", 401, `Unauthorized: ${path}`, errorMessageOf(data));
    }
    if (!res.ok) {
      throw new ApiError("http", res.status, `HTTP ${res.status}: ${path}`, errorMessageOf(data));
    }
    return { status: res.status, data: data as T };
  }

  return {
    baseUrl: options.baseUrl,
    request,
    async get<T>(path: string, requestOptions?: RequestOptions) {
      return (await request<T>("GET", path, undefined, requestOptions)).data;
    },
    async post<T>(path: string, body?: unknown, requestOptions?: RequestOptions) {
      return (await request<T>("POST", path, body ?? {}, requestOptions)).data;
    },
    async del<T>(path: string, requestOptions?: RequestOptions) {
      return (await request<T>("DELETE", path, undefined, requestOptions)).data;
    },
  };
}
