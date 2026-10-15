import { useState } from "react"
import {
  BackButton,
  Button,
  Card,
  InputField,
  Logo,
  ScreenShell,
} from "../../shared/ui"
import type { UserRole } from "./types"
import { useAuth } from "./useAuth"

export function SignUpScreen({
  onBack,
  onSuccess,
  onGoToSignIn,
}: {
  onBack: () => void
  onSuccess: (isAdmin: boolean) => void
  onGoToSignIn: () => void
}) {
  const { signUp } = useAuth()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [role, setRole] = useState<UserRole>("member")
  const [error, setError] = useState("")
  const [infoMessage, setInfoMessage] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault()

    if (!fullName.trim()) {
      setError("Please enter your full name.")
      return
    }
    if (!email.trim()) {
      setError("Please enter your email address.")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    setError("")
    setInfoMessage("")

    const res = await signUp(email, password, fullName, role)
    setLoading(false)

    if (res.ok) {
      if (res.requiresEmailConfirmation) {
        setInfoMessage(
          "Registration successful! Please check your email inbox to verify your account before logging in.",
        )
      } else {
        onSuccess(role === "admin")
      }
    } else {
      setError(res.error || "Failed to create account. Please try again.")
    }
  }

  return (
    <ScreenShell>
      <BackButton onClick={onBack} />

      <div className="mb-6 flex justify-center">
        <Logo size="md" />
      </div>

      <Card>
        <div className="border-b border-[#D1D9E8] pb-4 mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#C9921A]">
            Get Started
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[#1B3A6B]">
            Create your account
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Join your parish community and start coordinating your ministry
            schedules.
          </p>
        </div>

        {infoMessage ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-[#E8F5EE] border border-[#2D7A4F]/20 p-4 text-[#2D7A4F]">
              <p className="font-bold text-base">Check your email</p>
              <p className="text-sm mt-1">{infoMessage}</p>
            </div>
            <Button onClick={onGoToSignIn} variant="primary">
              Proceed to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <InputField
              id="signup-name"
              label="Full Name"
              value={fullName}
              onChange={(v) => {
                setFullName(v)
                setError("")
              }}
              placeholder="e.g. Maria Santos"
              autoComplete="name"
            />

            <InputField
              id="signup-email"
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
              id="signup-password"
              label="Password"
              type="password"
              value={password}
              onChange={(v) => {
                setPassword(v)
                setError("")
              }}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />

            <InputField
              id="signup-confirm-password"
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(v) => {
                setConfirmPassword(v)
                setError("")
              }}
              placeholder="Re-enter your password"
              autoComplete="new-password"
            />

            <div>
              <label
                htmlFor="signup-role"
                className="text-xs font-bold uppercase tracking-wider text-[#1B3A6B] block mb-1.5"
              >
                Account Type
              </label>
              <div className="grid grid-cols-2 gap-3" id="signup-role">
                <button
                  type="button"
                  onClick={() => setRole("member")}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    role === "member"
                      ? "border-[#1B3A6B] bg-[#1B3A6B]/5 text-[#1B3A6B] font-bold"
                      : "border-[#D1D9E8] text-[#64748B] hover:bg-gray-50"
                  }`}
                >
                  <p className="text-sm font-bold">Volunteer</p>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Sign up for slots & manage availability
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("admin")}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    role === "admin"
                      ? "border-[#1B3A6B] bg-[#1B3A6B]/5 text-[#1B3A6B] font-bold"
                      : "border-[#D1D9E8] text-[#64748B] hover:bg-gray-50"
                  }`}
                >
                  <p className="text-sm font-bold">Admin</p>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Coordinate schedules & members
                  </p>
                </button>
              </div>
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
              {loading ? "Creating Account..." : "Create Account"}
            </Button>

            <div className="text-center mt-2">
              <span className="text-xs text-[#64748B]">
                Already have an account?{" "}
              </span>
              <button
                type="button"
                onClick={onGoToSignIn}
                className="text-xs font-bold text-[#2563EB] hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </form>
        )}
      </Card>
    </ScreenShell>
  )
}
