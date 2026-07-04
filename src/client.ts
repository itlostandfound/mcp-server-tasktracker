export type TaskTrackerErrorKind =
  | "connection"
  | "auth"
  | "not_found"
  | "conflict"
  | "validation"
  | "unknown";

export class TaskTrackerError extends Error {
  constructor(
    message: string,
    public readonly kind: TaskTrackerErrorKind,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "TaskTrackerError";
  }
}

export interface TaskTrackerClientOptions {
  baseUrl: string;
  token: string;
  debug?: boolean;
}

function formatValidationDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((entry) => {
        if (entry && typeof entry === "object" && "loc" in entry && "msg" in entry) {
          const loc = Array.isArray((entry as any).loc) ? (entry as any).loc.join(".") : String((entry as any).loc);
          return `${loc}: ${(entry as any).msg}`;
        }
        return JSON.stringify(entry);
      })
      .join("; ");
  }
  return JSON.stringify(detail);
}

/**
 * Thin typed wrapper around the Task-Tracker REST API. Every method throws a
 * TaskTrackerError with a human-readable message on failure so MCP tool
 * handlers can surface it directly to the calling agent.
 */
export class TaskTrackerClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly debug: boolean;

  constructor(options: TaskTrackerClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.token = options.token;
    this.debug = options.debug ?? false;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.error("[mcp-server-tasktracker]", ...args);
    }
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    this.log("->", method, url, body !== undefined ? JSON.stringify(body) : "");

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new TaskTrackerError(
        `Could not reach Task-Tracker at ${this.baseUrl}: ${reason}`,
        "connection",
      );
    }

    this.log("<-", response.status, method, url);

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    let json: any;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
    }

    if (!response.ok) {
      const detail = json?.detail;

      if (response.status === 401) {
        throw new TaskTrackerError(
          "Authentication failed — check TASKTRACKER_API_TOKEN.",
          "auth",
          401,
        );
      }
      if (response.status === 404) {
        throw new TaskTrackerError(
          detail ? formatValidationDetail(detail) : "Not found.",
          "not_found",
          404,
        );
      }
      if (response.status === 409) {
        throw new TaskTrackerError(
          detail ? formatValidationDetail(detail) : "Conflict.",
          "conflict",
          409,
        );
      }
      if (response.status === 400 || response.status === 422) {
        throw new TaskTrackerError(
          detail ? formatValidationDetail(detail) : "Invalid request.",
          "validation",
          response.status,
        );
      }

      throw new TaskTrackerError(
        `Task-Tracker returned an unexpected error (HTTP ${response.status}): ${
          detail ? formatValidationDetail(detail) : text
        }`,
        "unknown",
        response.status,
      );
    }

    if (text && json === undefined) {
      throw new TaskTrackerError(
        `Task-Tracker returned a non-JSON response (HTTP ${response.status}) — check TASKTRACKER_API_URL: ${text.slice(0, 200)}`,
        "unknown",
        response.status,
      );
    }

    return json as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body ?? {});
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body ?? {});
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body ?? {});
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}
