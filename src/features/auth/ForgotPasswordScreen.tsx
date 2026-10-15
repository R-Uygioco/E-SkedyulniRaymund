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

export function ForgotPasswordScreen({
  onBack,
  onGoToSignIn,
}: {
  onBack: () => void
  onGoToSignIn: () => void
}) {
  const { resetPassword } = useAuth()

  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!email.trim()) {
      setError("Please enter your registered email address.")
      return
    }

    setLoading(true)
    setError("")

    const res = await resetPassword(email)
    setLoading(false)

    if (res.ok) {
      setSent(true)
    } else {
      setError(res.error || "Failed to send reset email.")
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
            Account Recovery
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[#1B3A6B]">
            Reset your password
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Enter your email address to receive password reset instructions.
          </p>
        </div>

        {sent ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-[#E8F5EE] border border-[#2D7A4F]/20 p-4 text-[#2D7A4F]">
              <p className="font-bold text-base">Check your email</p>
              <p className="text-sm mt-1">
                We've sent a password reset link to <strong>{email}</strong>.
                Please check your inbox.
              </p>
            </div>

            <Button onClick={onGoToSignIn} variant="primary">
              Return to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <InputField
              id="reset-email"
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

            {error && (
              <div
                role="alert"
                className="rounded-xl bg-[#FDEDEC] p-3 text-sm font-semibold text-[#C0392B]"
              >
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? "Sending link..." : "Send Reset Link"}
            </Button>

            <div className="text-center mt-2">
              <button
                type="button"
                onClick={onGoToSignIn}
                className="text-xs font-bold text-[#2563EB] hover:underline cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}
      </Card>
    </ScreenShell>
  )
}
