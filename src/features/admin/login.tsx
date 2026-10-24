import { useState, type FormEvent } from "react"

import { BackButton, Button, Card, InputField, Logo, ScreenShell } from "../../shared/ui"
import { apiRequest, getApiErrorMessage, setAdminToken, type AdminLoginResponse } from "../../lib/api"

export function AdminLoginScreen({
  onBack,
  onAuthenticated,
}: {
  onBack: () => void
  onAuthenticated: () => void
}) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function signIn() {
    if (!username.trim() || !password) {
      setError("Enter your username and password.")
      return
    }

    setLoading(true)
    setError("")

    try {
      const result = await apiRequest<AdminLoginResponse>(
        "/admin/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        },
        false,
      )

      if (!result.access_token || result.user?.role !== "admin") {
        throw new Error("The backend did not return a valid administrator session.")
      }

      setAdminToken(result.access_token)
      onAuthenticated()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScreenShell>
      <BackButton onClick={onBack} />
      <div className="mb-7 flex justify-center">
        <Logo size="md" />
      </div>
      <Card>
        <div className="border-b border-border pb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gold">Administration</p>
          <p className="mt-2 text-2xl font-bold text-navy">Admin sign in</p>
          <p className="mt-2 text-base leading-relaxed text-muted">
            Sign in with your administrator account to manage organizations and events.
          </p>
        </div>
        <form
          className="mt-6 flex flex-col gap-5"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            void signIn()
          }}
        >
          <InputField
            id="admin-username"
            label="Username"
            value={username}
            onChange={value => {
              setUsername(value)
              setError("")
            }}
            placeholder="Enter username"
            autoComplete="username"
          />
          <InputField
            id="admin-password"
            label="Password"
            type="password"
            value={password}
            onChange={value => {
              setPassword(value)
              setError("")
            }}
            placeholder="Enter password"
            autoComplete="current-password"
          />
          {error && (
            <p role="alert" className="rounded-xl bg-red-light p-4 text-sm font-semibold text-red">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in to admin"}
          </Button>
        </form>
      </Card>
      <p className="mt-5 text-center text-sm leading-relaxed text-muted">
        This workspace is restricted to authorized administrators.
      </p>
    </ScreenShell>
  )
}
