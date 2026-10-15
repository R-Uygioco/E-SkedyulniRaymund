import { useState } from "react"
import {
  BackButton,
  Button,
  Card,
  InputField,
  Logo,
  ScreenShell,
} from "../../shared/ui"
import { useAuth } from "./useAuth"

export function SignInScreen({
  onBack,
  onSuccess,
  onGoToSignUp,
  onGoToForgotPassword,
}: {
  onBack: () => void
  onSuccess: (isAdmin: boolean) => void
  onGoToSignUp: () => void
  onGoToForgotPassword: () => void
}) {
  const { signIn, signInAsDemo, isConfigured } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!email.trim() || !password) {
      setError("Please provide both email and password.")
      return
    }

    setLoading(true)
    setError("")

    const res = await signIn(email, password)
    setLoading(false)

    if (res.ok) {
      const isAdminUser = email.toLowerCase().includes("admin")
      onSuccess(isAdminUser)
    } else {
      setError(res.error || "Failed to sign in. Please check your credentials.")
    }
  }

  function handleDemoLogin(role: "member" | "admin") {
    signInAsDemo(role)
    onSuccess(role === "admin")
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
        <div className="border-b border-[#D1D9E8] pb-4 mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#C9921A]">
            Welcome Back
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[#1B3A6B]">
            Sign in to E-Skedyul
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Access your ministry schedule, sign up for open slots, and manage
            availability.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <InputField
            id="signin-email"
            label="Email Address"
            type="email"
            value={email}
            onChange={(v) => {
              setEmail(v)
              setError("")
            }}
            placeholder="e.g. maria@example.com"
            autoComplete="email"
          />

          <InputField
            id="signin-password"
            label="Password"
            type="password"
            value={password}
            onChange={(v) => {
              setPassword(v)
              setError("")
            }}
            placeholder="Enter your password"
            autoComplete="current-password"
          />

          <div className="flex justify-end -mt-1">
            <button
              type="button"
              onClick={onGoToForgotPassword}
              className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
            >
              Forgot password?
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl bg-[#FDEDEC] p-3 text-sm font-semibold text-[#C0392B]"
            >
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#D1D9E8]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-[#64748B]">or</span>
            </div>
          </div>

          <Button type="button" variant="secondary" onClick={onGoToSignUp}>
            Create New Account
          </Button>

          {!isConfigured && (
            <div className="mt-3 p-3 bg-[#EFF6FF] border border-[#2563EB]/20 rounded-xl flex flex-col gap-2">
              <p className="text-xs text-[#2563EB] font-bold">
                Quick Demo Login (No Supabase setup needed):
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDemoLogin("member")}
                  className="px-2 py-1.5 text-xs font-bold rounded-lg bg-white border border-[#2563EB]/30 text-[#1B3A6B] hover:bg-[#2563EB]/5 cursor-pointer"
                >
                  Volunteer Demo
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoLogin("admin")}
                  className="px-2 py-1.5 text-xs font-bold rounded-lg bg-white border border-[#2563EB]/30 text-[#1B3A6B] hover:bg-[#2563EB]/5 cursor-pointer"
                >
                  Admin Demo
                </button>
              </div>
            </div>
          )}
        </form>
      </Card>
    </ScreenShell>
  )
}
