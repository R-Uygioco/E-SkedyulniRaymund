import React, { createContext, useContext, useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import {
  clearSupabaseCredentials,
  isSupabaseConfigured,
  saveSupabaseCredentials,
  supabase,
} from "../../lib/supabase"
import type { AuthContextValue, UserProfile, UserRole } from "./types"

const AuthContext = createContext<AuthContextValue | null>(null)

const DEMO_USER_STORAGE_KEY = "eskedyul_demo_user"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const isConfigured = isSupabaseConfigured()

  // Helper to extract or resolve profile details
  async function resolveProfile(activeUser: User): Promise<UserProfile> {
    const metaFullName = (activeUser.user_metadata?.full_name as string) || ""
    const metaRole = (activeUser.user_metadata?.role as UserRole) || "member"
    const fallbackName = metaFullName.trim() || activeUser.email?.split("@")[0] || "Volunteer"

    let resolvedProfile: UserProfile = {
      id: activeUser.id,
      email: activeUser.email || "",
      fullName: fallbackName,
      role: metaRole,
      parish: (activeUser.user_metadata?.parish as string) || "St. Joseph Parish",
      ministry: (activeUser.user_metadata?.ministry as string) || "Lectors",
    }

    // If Supabase is configured, try querying the public profiles table
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, email, full_name, role, parish, ministry")
          .eq("id", activeUser.id)
          .maybeSingle()

        if (!error && data) {
          resolvedProfile = {
            id: data.id,
            email: data.email || activeUser.email || "",
            fullName: data.full_name || fallbackName,
            role: (data.role as UserRole) || metaRole,
            parish: data.parish || resolvedProfile.parish,
            ministry: data.ministry || resolvedProfile.ministry,
          }
        }
      } catch {
        // Table might not exist yet; gracefully keep metadata fallback
      }
    }

    return resolvedProfile
  }

  // Restore session on mount
  useEffect(() => {
    let mounted = true

    if (isConfigured) {
      supabase.auth.getSession().then(({ data: { session: activeSession }, error }) => {
        if (!mounted) return
        if (!error && activeSession) {
          setSession(activeSession)
          setUser(activeSession.user)
          resolveProfile(activeSession.user).then(p => {
            if (mounted) setProfile(p)
          })
        }
        setLoading(false)
      })

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (!mounted) return
        setSession(newSession)
        setUser(newSession?.user ?? null)
        if (newSession?.user) {
          const p = await resolveProfile(newSession.user)
          if (mounted) setProfile(p)
        } else {
          setProfile(null)
        }
        setLoading(false)
      })

      return () => {
        mounted = false
        subscription.unsubscribe()
      }
    } else {
      // Demo/Offline Mode check
      try {
        const savedDemo = sessionStorage.getItem(DEMO_USER_STORAGE_KEY)
        if (savedDemo) {
          const parsed = JSON.parse(savedDemo) as UserProfile
          setProfile(parsed)
        }
      } catch {
        // ignore storage parse errors
      }
      setLoading(false)
      return () => {
        mounted = false
      }
    }
  }, [isConfigured])

  // Sign in with email & password
  async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    if (!isConfigured) {
      // Demo authentication fallback
      if (email.toLowerCase().includes("admin") || password === "admin123") {
        signInAsDemo("admin")
        return { ok: true }
      }
      signInAsDemo("member")
      return { ok: true }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        return { ok: false, error: error.message }
      }
      if (data.user) {
        setUser(data.user)
        setSession(data.session)
        const p = await resolveProfile(data.user)
        setProfile(p)
      }
      return { ok: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred during sign in."
      return { ok: false, error: msg }
    }
  }

  // Sign up with email & password
  async function signUp(
    email: string,
    password: string,
    fullName: string,
    role: UserRole = "member",
  ): Promise<{ ok: boolean; error?: string; requiresEmailConfirmation?: boolean }> {
    if (!isConfigured) {
      const demoProfile: UserProfile = {
        id: `demo-${Date.now()}`,
        email: email.trim(),
        fullName: fullName.trim() || "Maria Santos",
        role,
        parish: "St. Joseph Parish",
        ministry: "Lectors",
      }
      sessionStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(demoProfile))
      setProfile(demoProfile)
      return { ok: true }
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role,
          },
        },
      })
      if (error) {
        return { ok: false, error: error.message }
      }

      if (data.session && data.user) {
        setUser(data.user)
        setSession(data.session)
        const p = await resolveProfile(data.user)
        setProfile(p)
        return { ok: true }
      }

      // If Supabase has email confirmation enabled
      if (data.user && !data.session) {
        return { ok: true, requiresEmailConfirmation: true }
      }

      return { ok: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred during sign up."
      return { ok: false, error: msg }
    }
  }

  // Sign out
  async function signOut(): Promise<void> {
    if (isConfigured) {
      try {
        await supabase.auth.signOut()
      } catch {
        // ignore sign out error
      }
    } else {
      sessionStorage.removeItem(DEMO_USER_STORAGE_KEY)
    }
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  // Reset password
  async function resetPassword(email: string): Promise<{ ok: boolean; error?: string }> {
    if (!isConfigured) {
      return {
        ok: true,
        error: "Demo mode: Password reset instructions simulated. (Connect Supabase to send real emails)",
      }
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      })
      if (error) {
        return { ok: false, error: error.message }
      }
      return { ok: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send reset email."
      return { ok: false, error: msg }
    }
  }

  // Update profile
  async function updateProfile(updates: Partial<UserProfile>): Promise<{ ok: boolean; error?: string }> {
    if (!profile) return { ok: false, error: "No active profile to update." }

    const nextProfile: UserProfile = { ...profile, ...updates }
    setProfile(nextProfile)

    if (isConfigured && user) {
      try {
        await supabase.auth.updateUser({
          data: {
            full_name: nextProfile.fullName,
            role: nextProfile.role,
            parish: nextProfile.parish,
            ministry: nextProfile.ministry,
          },
        })

        // Also update profiles table if it exists
        await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            email: nextProfile.email,
            full_name: nextProfile.fullName,
            role: nextProfile.role,
            parish: nextProfile.parish,
            ministry: nextProfile.ministry,
            updated_at: new Date().toISOString(),
          })
      } catch {
        // silent fail on table sync
      }
    } else {
      sessionStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(nextProfile))
    }

    return { ok: true }
  }

  // Demo sign-in for testing without configuration
  function signInAsDemo(role: UserRole = "member") {
    const demoProfile: UserProfile = {
      id: `demo-${Date.now()}`,
      email: role === "admin" ? "admin@eskedyul.ph" : "maria.santos@eskedyul.ph",
      fullName: role === "admin" ? "Fr. Raymund Admin" : "Maria Santos",
      role,
      parish: "St. Joseph Parish",
      ministry: "Lectors",
    }
    sessionStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(demoProfile))
    setProfile(demoProfile)
  }

  function handleSaveCredentials(url: string, key: string) {
    saveSupabaseCredentials(url, key)
    window.location.reload()
  }

  function handleClearCredentials() {
    clearSupabaseCredentials()
    window.location.reload()
  }

  const isAdmin = profile?.role === "admin" || (user?.user_metadata?.role as string) === "admin"

  const value: AuthContextValue = {
    user,
    session,
    profile,
    loading,
    isConfigured,
    isAdmin,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    signInAsDemo,
    saveCredentials: handleSaveCredentials,
    clearCredentials: handleClearCredentials,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
