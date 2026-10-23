import { Button, useSheetClose } from "../../shared/ui"
import { useAuth } from "./useAuth"

export function UserProfileSheet({
  onClose,
  onSignOut,
  onOpenAdmin,
}: {
  onClose: () => void
  onSignOut: () => void
  onOpenAdmin?: () => void
}) {
  const { profile, user, isConfigured, isAdmin, signOut } = useAuth()
  const { closing, close } = useSheetClose()

  const displayName =
    profile?.fullName || user?.user_metadata?.full_name || "Maria Santos"
  const email = profile?.email || user?.email || "maria.santos@eskedyul.ph"
  const role = profile?.role || (isAdmin ? "admin" : "member")
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  async function handleSignOut() {
    await signOut()
    close(onSignOut)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="User Profile"
      data-closing={closing}
    >
      <div
        className="sheet-backdrop absolute inset-0 bg-black/50"
        onClick={() => close(onClose)}
        aria-hidden="true"
      />

      <div className="sheet-panel relative w-full max-w-lg rounded-t-3xl bg-white px-6 pb-8 pt-4 shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#D1D9E8]" />

        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#1B3A6B]">
            Account Profile
          </h3>
          <Button
            variant="ghost"
            size="compact"
            fullWidth={false}
            onClick={() => close(onClose)}
          >
            Close
          </Button>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#F4F6FB] border border-[#D1D9E8] mb-5">
          <div className="w-14 h-14 rounded-full bg-[#1B3A6B] text-white flex items-center justify-center font-extrabold text-xl shadow-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-lg text-[#1A202C] truncate">
                {displayName}
              </p>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  role === "admin"
                    ? "bg-[#C9921A] text-white"
                    : "bg-[#2563EB]/15 text-[#2563EB]"
                }`}
              >
                {role === "admin" ? "Admin" : "Volunteer"}
              </span>
            </div>
            <p className="text-sm text-[#64748B] truncate mt-0.5">{email}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-6 text-sm">
          <div className="flex justify-between py-2 border-b border-[#D1D9E8]">
            <span className="text-[#64748B]">Parish</span>
            <span className="font-semibold text-[#1A202C]">
              {profile?.parish || "St. Joseph Parish"}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#D1D9E8]">
            <span className="text-[#64748B]">Primary Ministry</span>
            <span className="font-semibold text-[#1A202C]">
              {profile?.ministry || "Lectors"}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-[#D1D9E8]">
            <span className="text-[#64748B]">Backend Service</span>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  isConfigured ? "bg-[#2D7A4F]" : "bg-[#C9921A]"
                }`}
              />
              <span className="font-semibold text-[#1A202C]">
                {isConfigured ? "Server Live (Supabase Connected)" : "Demo Mode"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {role === "admin" && onOpenAdmin && (
            <Button
              variant="secondary"
              onClick={() => {
                close(onClose)
                onOpenAdmin()
              }}
            >
              Go to Admin Portal
            </Button>
          )}

          <Button variant="danger" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  )
}
