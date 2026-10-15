import { useState } from "react"
import { UserProfileSheet } from "../features/auth/UserProfileSheet"
import { Button, useSheetClose } from "./ui"

export type HomeTab = "availability" | "slots"

type Ministry = {
  id: string
  name: string
  parish: string
  waiting?: boolean
}

export const MINISTRIES: Ministry[] = [
  { id: "lectors", name: "Lectors", parish: "St. Joseph Parish" },
  { id: "altar", name: "Altar Servers", parish: "St. Joseph Parish" },
  { id: "choir", name: "Parish Choir", parish: "St. Joseph Parish" },
  { id: "youth", name: "Youth Ministry", parish: "St. Joseph Parish", waiting: true },
]

function MinistrySheet({ selected, onSelect, onClose, onJoin }: {
  selected: Ministry
  onSelect: (ministry: Ministry) => void
  onClose: () => void
  onJoin: () => void
}) {
  const { closing, close } = useSheetClose()
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="My Ministries" data-closing={closing}>
      <div className="sheet-backdrop absolute inset-0 bg-black/50" onClick={() => close(onClose)} aria-hidden="true" />
      <div className="sheet-panel relative w-full max-w-lg rounded-t-3xl bg-white px-5 pb-8 pt-4 shadow-2xl">
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#D1D9E8]" />
        <div className="mb-3 flex items-center justify-between">
          <p className="text-2xl font-bold text-[#1B3A6B]">My Ministries</p>
          <Button variant="ghost" size="compact" fullWidth={false} onClick={() => close(onClose)}>Close</Button>
        </div>
        <div className="divide-y divide-[#D1D9E8]">
          {MINISTRIES.map(ministry => (
            <button
              key={ministry.id}
              disabled={ministry.waiting}
              onClick={() => close(() => onSelect(ministry))}
              className="flex min-h-[72px] w-full items-center justify-between gap-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[18px] font-bold text-[#1A202C]">{ministry.name}</span>
                </div>
                <p className="mt-1 text-[16px] text-[#64748B]">
                  {ministry.waiting ? "Waiting for approval" : ministry.parish}
                </p>
              </div>
              {selected.id === ministry.id && <span className="text-2xl font-bold text-[#2D7A4F]" aria-label="Selected">✓</span>}
            </button>
          ))}
        </div>
        <div className="mt-4 border-t border-[#D1D9E8] pt-4">
          <Button variant="secondary" onClick={onJoin}>+ Join Another Ministry</Button>
        </div>
      </div>
    </div>
  )
}

function greeting() {
  const hour = new Date().getHours()
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
}

export function HomeScreen({
  userName,
  ministry,
  onMinistryChange,
  tab,
  onTabChange,
  onJoin,
  onSignOut,
  onOpenAdmin,
  children,
}: {
  userName: string
  ministry: Ministry
  onMinistryChange: (ministry: Ministry) => void
  tab: HomeTab
  onTabChange: (tab: HomeTab) => void
  onJoin: () => void
  onSignOut?: () => void
  onOpenAdmin?: () => void
  children: React.ReactNode // the open tab's content
}) {
  const [showMinistries, setShowMinistries] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  // The Availability tab holds the weekly timetable, so it gets the wide layout.
  const wide = tab === "availability"

  function switchMinistry(next: Ministry) {
    onMinistryChange(next)
    setShowMinistries(false)
  }

  const initial = userName.trim().charAt(0).toUpperCase() || "M"

  return (
    <div className="min-h-screen bg-[#F4F6FB]" style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
      <div className="bg-[#1B3A6B] px-4 pb-5 text-white" style={{ paddingTop: "calc(2.5rem + env(safe-area-inset-top))" }}>
        <div className={`mx-auto ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[16px] text-white/70">{greeting()}, {userName.split(" ")[0]}</p>
              <p className="text-xl font-bold">E-Skedyul</p>
            </div>
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 transition-colors cursor-pointer border border-white/20 active:scale-95"
              aria-label="Account Profile and Settings"
            >
              <div className="w-7 h-7 rounded-full bg-[#C9921A] text-white flex items-center justify-center font-extrabold text-xs">
                {initial}
              </div>
              <span className="text-xs font-semibold text-white/90">Profile</span>
            </button>
          </div>
          <button onClick={() => setShowMinistries(true)} className="flex min-h-[64px] w-full items-center justify-between rounded-2xl bg-white px-5 text-left text-[#1B3A6B] shadow-sm cursor-pointer">
            <div>
              <p className="text-[14px] font-semibold text-[#64748B]">Current ministry</p>
              <p className="text-xl font-extrabold">{ministry.name} ▾</p>
            </div>
          </button>
        </div>
      </div>

      <main className={`mx-auto px-4 py-5 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
        {children}
      </main>

      <nav className="fixed left-3 right-3 z-30 mx-auto grid max-w-3xl grid-cols-2 gap-1 rounded-3xl border border-white/70 bg-white/60 p-2 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_rgba(27,58,107,0.18)]" style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        {([
          ["availability", "Availability"],
          ["slots", "Open Slots"],
        ] as Array<[HomeTab, string]>).map(([value, label]) => (
          <button key={value} onClick={() => onTabChange(value)} className={`min-h-[52px] rounded-2xl px-2 text-[15px] font-bold transition-all duration-200 cursor-pointer ${tab === value ? "bg-[#1B3A6B]/10 text-[#1B3A6B] ring-1 ring-[#1B3A6B]/15 shadow-sm" : "text-[#64748B] hover:bg-white/50"}`}>
            {label}
          </button>
        ))}
      </nav>

      {showMinistries && (
        <MinistrySheet
          selected={ministry}
          onClose={() => setShowMinistries(false)}
          onSelect={switchMinistry}
          onJoin={onJoin}
        />
      )}

      {showProfile && (
        <UserProfileSheet
          onClose={() => setShowProfile(false)}
          onSignOut={() => {
            setShowProfile(false)
            onSignOut?.()
          }}
          onOpenAdmin={onOpenAdmin}
        />
      )}
    </div>
  )
}
