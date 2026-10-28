const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()

// Vercel serves the frontend over HTTPS; localhost points to each visitor's
// own device, so it must never be the silent production API fallback.
const API_BASE_URL = (configuredApiUrl || "").replace(/\/+$/, "")

const ADMIN_TOKEN_KEY = "eskedyul_admin_access_token"
export const ADMIN_UNAUTHORIZED_EVENT = "eskedyul:admin-unauthorized"

export type AdminLoginResponse = {
  access_token: string
  token_type: string
  user: {
    id: string
    username: string
    email: string
    fullName: string
    role: string
  }
}

type ErrorPayload = {
  detail?: unknown
  message?: unknown
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(ADMIN_TOKEN_KEY)
}

export function setAdminToken(token: string): void {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export function clearAdminToken(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY)
  }
}

function errorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const data = payload as ErrorPayload

    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail
    }

    if (typeof data.message === "string" && data.message.trim()) {
      return data.message
    }

    if (Array.isArray(data.detail)) {
      return data.detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: unknown }).msg)
          }
          return String(item)
        })
        .join("; ")
    }
  }

  return `Request failed with status ${status}.`
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  requiresAuthentication = true,
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set("Accept", "application/json")

  if (options.body !== undefined && options.body !== null) {
    headers.set("Content-Type", "application/json")
  }

  if (requiresAuthentication) {
    const token = getAdminToken()

    if (!token) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(ADMIN_UNAUTHORIZED_EVENT))
      }
      throw new Error("Please sign in again to continue.")
    }

    headers.set("Authorization", `Bearer ${token}`)
  }

  if (!API_BASE_URL) {
    throw new Error(
      "The Admin API URL is not configured for this deployment. Set VITE_API_URL to your deployed FastAPI HTTPS URL in the Vercel project settings, then redeploy.",
    )
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    })
  } catch {
    throw new Error(
      `Cannot connect to the E-Skedyul API at ${API_BASE_URL}. Verify that the FastAPI backend is deployed, reachable, and allows this website in CORS settings.`,
    )
  }

  let payload: unknown = null

  if (response.status !== 204) {
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    if (response.status === 401 && requiresAuthentication) {
      clearAdminToken()
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(ADMIN_UNAUTHORIZED_EVENT))
      }
    }

    throw new Error(errorMessage(payload, response.status))
  }

  return payload as T
}

export async function logoutAdmin(): Promise<void> {
  try {
    await apiRequest<{ message: string }>(
      "/admin/auth/logout",
      { method: "POST" },
      false,
    )
  } finally {
    clearAdminToken()
  }
}

export function getApiErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred."
}
