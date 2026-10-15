import type { Session, User } from "@supabase/supabase-js"

export type UserRole = "member" | "admin"

export interface UserProfile {
  id: string
  email: string
  fullName: string
  role: UserRole
  ministry?: string
  parish?: string
}

export interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  isConfigured: boolean
  isAdmin: boolean
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role?: UserRole,
  ) => Promise<{
    ok: boolean
    error?: string
    requiresEmailConfirmation?: boolean
  }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ ok: boolean; error?: string }>
  updateProfile: (
    updates: Partial<UserProfile>,
  ) => Promise<{ ok: boolean; error?: string }>
  signInAsDemo: (role?: UserRole) => void
  saveCredentials: (url: string, key: string) => void
  clearCredentials: () => void
}
