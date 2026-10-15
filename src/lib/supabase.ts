import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const STORAGE_URL_KEY = "eskedyul_supabase_url"
const STORAGE_ANON_KEY = "eskedyul_supabase_anon_key"

/**
 * Retrieve the current Supabase URL and Anon Key from environment variables
 * or local storage overrides.
 */
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || ""
  const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ""

  let storedUrl = ""
  let storedKey = ""
  if (typeof window !== "undefined") {
    try {
      storedUrl = localStorage.getItem(STORAGE_URL_KEY) || ""
      storedKey = localStorage.getItem(STORAGE_ANON_KEY) || ""
    } catch {
      // ignore storage access restrictions
    }
  }

  const url = (storedUrl || envUrl || "").trim()
  const anonKey = (storedKey || envAnonKey || "").trim()

  return { url, anonKey }
}

/**
 * Checks whether Supabase has been configured with valid credentials.
 */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials()
  if (!url || !anonKey) return false
  if (url.includes("your-project-id") || anonKey.includes("your-anon-key"))
    return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
  } catch {
    return false
  }
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_URL_KEY, url.trim())
    localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim())
  }
}

export function clearSupabaseCredentials(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_URL_KEY)
    localStorage.removeItem(STORAGE_ANON_KEY)
  }
}

// Fallback placeholder credentials to prevent createClient from crashing if not yet configured.
const PLACEHOLDER_URL = "https://placeholder-parish-project.supabase.co"
const PLACEHOLDER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder"

function initClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials()
  const activeUrl = isSupabaseConfigured() ? url : PLACEHOLDER_URL
  const activeKey = isSupabaseConfigured() ? anonKey : PLACEHOLDER_KEY

  return createClient(activeUrl, activeKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export const supabase: SupabaseClient = initClient()
