import { useState } from "react"
import {
  BackButton,
  Button,
  Card,
  InputField,
  Logo,
  ScreenShell,
} from "../../shared/ui"
import { useAuth } from "../auth/useAuth"

const DEMO_ADMIN_USER = "admin"
const DEMO_ADMIN_PASS = "admin123"

export function AdminLoginScreen({
  onBack,
  onAuthenticated,
}: {
  onBack: () => void
  onAuthenticated: () => void
}) {
  const { signIn, signInAsDemo, isConfigured } = useAuth()
  const [emailOrUser, setEmailOrUser] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSignIn(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const identifier = emailOrUser.trim()

    if (!identifier || !password) {
      setError("Enter your admin username/email and password.")
      return
    }

    setLoading(true)
    setError("")

    // Try hardcoded demo admin credentials first
    if (
      identifier.toLowerCase() === DEMO_ADMIN_USER &&
      password === DEMO_ADMIN_PASS
    ) {
      signInAsDemo("admin")
      setLoading(false)
      onAuthenticated()
      return
    }

    // Try Supabase auth
    if (isConfigured) {
      const res = await signIn(identifier, password)
      setLoading(false)
      if (res.ok) {
        onAuthenticated()
      } else {
        setError(res.error || "The username or password is incorrect.")
      }
      return
    }

    setLoading(false)
    setError("The username or password is incorrect.")
  }

  function handleDemoAdmin() {
    setEmailOrUser(DEMO_ADMIN_USER)
    setPassword(DEMO_ADMIN_PASS)
    signInAsDemo("admin")
    onAuthenticated()
  }

  return (
    <ScreenShell>
      <BackButton onClick={onBack} />

      <div className="mb-6 flex flex-col items-center">
        <Logo size="md" />
        <div className="mt-3 flex items-center gap-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              isConfigured ? "bg-[#2D7A4F]" : "bg-[#C9921A]"
            }`}
          />
          <span className="text-xs font-semibold text-[#64748B]">
            {isConfigured ? "Server Live (Supabase Connected)" : "Demo Mode"}
          </span>
        </div>
      </div>

      <Card>
        <div className="border-b border-[#D1D9E8] pb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#C9921A]">
            Administration
          </p>
          <p className="mt-2 text-2xl font-bold text-[#1B3A6B]">
            Admin sign in
          </p>
          <p className="mt-2 text-base leading-relaxed text-[#64748B]">
            Sign in with your administrator account or Supabase credentials to
            manage organizations and events.
          </p>
        </div>

        <form onSubmit={handleSignIn} className="mt-6 flex flex-col gap-5">
          <InputField
            id="admin-username"
            label="Email or Username"
            value={emailOrUser}
            onChange={(value) => {
              setEmailOrUser(value)
              setError("")
            }}
            placeholder="admin@parish.ph or admin"
            autoComplete="username"
          />
          <InputField
            id="admin-password"
            label="Password"
            type="password"
            value={password}
            onChange={(value) => {
              setPassword(value)
              setError("")
            }}
            placeholder="Enter password"
            autoComplete="current-password"
          />

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-[#FDEDEC] p-4 text-sm font-semibold text-[#C0392B]"
            >
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? "Authenticating..." : "Sign in to admin"}
          </Button>

          {!isConfigured && (
            <div className="p-3 bg-[#EFF6FF] border border-[#2563EB]/20 rounded-xl">
              <p className="text-xs text-[#2563EB] font-bold mb-1.5">
                Demo Admin Shortcut:
              </p>
              <Button
                type="button"
                variant="secondary"
                size="compact"
                onClick={handleDemoAdmin}
              >
                Use Demo Credentials (admin / admin123)
              </Button>
            </div>
          )}
        </form>
      </Card>

      <p className="mt-5 text-center text-sm leading-relaxed text-[#64748B]">
        This workspace is restricted to authorized parish administrators.
      </p>
    </ScreenShell>
  )
}
