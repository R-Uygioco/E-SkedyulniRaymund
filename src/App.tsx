import { useState, useEffect, useRef } from "react"
import { BACK_TARGETS, type Screen } from "./navigation"
import { useIsDesktop } from "./shared/ui"
import { applyStatusBar, listenForBackButton } from "./shared/native"
import { HomeScreen, MINISTRIES, type HomeTab } from "./shared/home"

// Wizard
import {
  WelcomeScreen,
  TellNameScreen,
  JoinGroupScreen,
  PendingScreen,
} from "./features/wizard/wizard"
import {
  DesktopJoinGroupScreen,
  DesktopPendingScreen,
} from "./features/wizard/desktop"
import { useWizard } from "./features/wizard/useWizard"

// Availability
import {
  AvailabilityTab,
  SetRecurringScreen,
  AddOverrideScreen,
} from "./features/availability/availability"
import { useAvailability } from "./features/availability/useAvailability"

// Open Slots
import {
  SlotList,
  SlotVolunteerScreen,
  SlotServingScreen,
  SlotFilledScreen,
} from "./features/slots/slots"
import { useSlots } from "./features/slots/useSlots"
import { AdminScreen } from "./features/admin/admin"
import { AdminLoginScreen } from "./features/admin/login"

// Authentication & Supabase
import { AuthProvider, useAuth } from "./features/auth/AuthContext"
import { SignInScreen } from "./features/auth/SignInScreen"
import { SignUpScreen } from "./features/auth/SignUpScreen"
import { ForgotPasswordScreen } from "./features/auth/ForgotPasswordScreen"

function AppContent() {
  const isDesktop = useIsDesktop()
  const [screen, setScreen] = useState<Screen>("welcome")
  const [prevScreen, setPrevScreen] = useState<Screen>("welcome")
  const [adminAuthenticated, setAdminAuthenticated] = useState(false)

  const [homeTab, setHomeTab] = useState<HomeTab>("availability")
  const [ministry, setMinistry] = useState(MINISTRIES[0])

  const auth = useAuth()
  const wizard = useWizard()
  const availability = useAvailability()
  const slots = useSlots()

  function go(to: Screen) {
    setPrevScreen(screen)
    setScreen(to)
  }

  function reset() {
    wizard.reset()
    setHomeTab("availability")
    setMinistry(MINISTRIES[0])
    availability.resetPosition()
    setAdminAuthenticated(false)
    go("welcome")
  }

  // Keep active ministry in sync with Supabase profile
  useEffect(() => {
    if (auth.profile?.ministry) {
      const match = MINISTRIES.find(
        (m) => m.name.toLowerCase() === auth.profile?.ministry?.toLowerCase(),
      )
      if (match) {
        setMinistry(match)
      } else {
        setMinistry({
          id: auth.profile.ministry.toLowerCase().replace(/\s+/g, "-"),
          name: auth.profile.ministry,
          parish: auth.profile.parish || "St. Joseph Parish",
        })
      }
    }
  }, [auth.profile?.ministry, auth.profile?.parish])

  // Guard protected screens: prevent unauthenticated users from entering the scheduling system
  const isAuthScreen =
    screen === "welcome" ||
    screen === "sign-in" ||
    screen === "sign-up" ||
    screen === "forgot-password" ||
    screen === "admin-login"

  useEffect(() => {
    if (auth.loading) return

    // If user is not authenticated and on a protected screen, bounce them to welcome
    if (!auth.profile && !isAuthScreen) {
      setAdminAuthenticated(false)
      setScreen("welcome")
      return
    }

    // Auto-restore view if session is active and currently on welcome
    if (auth.profile && screen === "welcome") {
      if (auth.isAdmin) {
        setAdminAuthenticated(true)
        setScreen("admin")
      } else {
        setScreen("home")
      }
    }
  }, [auth.loading, auth.profile, auth.isAdmin, screen, isAuthScreen])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
    applyStatusBar(screen)
  }, [screen])

  // Android back button support (only active inside the Android app).
  const screenRef = useRef(screen)
  screenRef.current = screen
  const prevScreenRef = useRef(prevScreen)
  prevScreenRef.current = prevScreen
  const goRef = useRef(go)
  goRef.current = go
  useEffect(
    () =>
      listenForBackButton(
        BACK_TARGETS,
        () => screenRef.current,
        () => prevScreenRef.current,
        (to) => goRef.current(to),
      ),
    [],
  )

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6FB]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1B3A6B]/20 border-t-[#1B3A6B] rounded-full animate-spin" />
          <p className="text-sm font-semibold text-[#64748B]">Loading E-Skedyul...</p>
        </div>
      </div>
    )
  }

  const currentUserName =
    auth.profile?.fullName || wizard.form.name || "Maria Santos"

  switch (screen) {
    // ─── Welcome & Authentication ─────────────────────────────────────────────
    case "welcome":
      return (
        <WelcomeScreen
          onSignUp={() => go("sign-up")}
          onStart={() => go("sign-up")}
          onSignIn={() => go("sign-in")}
          onAdmin={() => go("admin-login")}
        />
      )

    case "sign-in":
      return (
        <SignInScreen
          onBack={() => go("welcome")}
          onSuccess={(isAdmin) => {
            if (isAdmin) {
              setAdminAuthenticated(true)
              go("admin")
            } else {
              go("home")
            }
          }}
          onGoToSignUp={() => go("sign-up")}
          onGoToForgotPassword={() => go("forgot-password")}
        />
      )

    case "sign-up":
      return (
        <SignUpScreen
          onBack={() => go("welcome")}
          onSuccess={(isAdmin) => {
            if (isAdmin) {
              setAdminAuthenticated(true)
              go("admin")
            } else {
              if (auth.profile?.fullName) {
                wizard.updateForm({ name: auth.profile.fullName })
              }
              go("join-group")
            }
          }}
          onGoToSignIn={() => go("sign-in")}
        />
      )

    case "forgot-password":
      return (
        <ForgotPasswordScreen
          onBack={() => go("sign-in")}
          onGoToSignIn={() => go("sign-in")}
        />
      )

    case "admin-login":
      return (
        <AdminLoginScreen
          onBack={() => go("welcome")}
          onAuthenticated={() => {
            setAdminAuthenticated(true)
            go("admin")
          }}
        />
      )

    case "admin":
      return adminAuthenticated || auth.isAdmin ? (
        <AdminScreen
          onLogout={() => {
            auth.signOut()
            setAdminAuthenticated(false)
            go("welcome")
          }}
        />
      ) : (
        <AdminLoginScreen
          onBack={() => go("welcome")}
          onAuthenticated={() => {
            setAdminAuthenticated(true)
            go("admin")
          }}
        />
      )

    // ─── Wizard ───────────────────────────────────────────────────────────────
    case "tell-name":
      return (
        <TellNameScreen
          firstName={
            wizard.firstName || auth.profile?.fullName.split(" ")[0] || ""
          }
          lastName={
            wizard.lastName ||
            auth.profile?.fullName.split(" ").slice(1).join(" ") ||
            ""
          }
          setFirstName={wizard.setFirstName}
          setLastName={wizard.setLastName}
          onBack={() => go("welcome")}
          onContinue={() => {
            const first =
              wizard.firstName || auth.profile?.fullName.split(" ")[0] || ""
            const last =
              wizard.lastName ||
              auth.profile?.fullName.split(" ").slice(1).join(" ") ||
              ""
            const fullName = `${first} ${last}`.trim()
            wizard.updateForm({ name: fullName })
            if (fullName && auth.profile) {
              auth.updateProfile({ fullName })
            }
            go("join-group")
          }}
        />
      )

    case "join-group": {
      // Back returns to wherever the member came from: Home via "+ Join Another Ministry", or Home after sign-up.
      const back = () => {
        if (prevScreen === "sign-up" || prevScreen === "tell-name") {
          go("home")
        } else {
          go(prevScreen)
        }
      }
      const handleGroupJoined = (groupName?: string) => {
        const targetGroup = groupName || wizard.form.groupName
        if (targetGroup && auth.profile) {
          auth.updateProfile({ ministry: targetGroup })
          const matched = MINISTRIES.find(
            (m) => m.name.toLowerCase() === targetGroup.toLowerCase(),
          )
          if (matched) {
            setMinistry(matched)
          } else {
            setMinistry({
              id: targetGroup.toLowerCase().replace(/\s+/g, "-"),
              name: targetGroup,
              parish: auth.profile.parish || "St. Joseph Parish",
            })
          }
        }
        go("pending")
      }
      return isDesktop ? (
        <DesktopJoinGroupScreen
          data={wizard.form}
          setData={wizard.updateForm}
          onJoin={handleGroupJoined}
          onBack={back}
        />
      ) : (
        <JoinGroupScreen
          data={wizard.form}
          setData={wizard.updateForm}
          onJoin={handleGroupJoined}
          onBack={back}
        />
      )
    }

    case "pending":
      return isDesktop ? (
        <DesktopPendingScreen
          data={wizard.form}
          onBack={() => go("join-group")}
          onApproved={() => go("home")}
        />
      ) : (
        <PendingScreen
          data={wizard.form}
          onBack={() => go("join-group")}
          onApproved={() => go("home")}
        />
      )

    // ─── Home (holds the Availability and Open Slots tabs) ────────────────────
    case "home":
      return (
        <HomeScreen
          userName={currentUserName}
          ministry={ministry}
          onMinistryChange={setMinistry}
          tab={homeTab}
          onTabChange={setHomeTab}
          onJoin={() => go("join-group")}
          onSignOut={() => {
            auth.signOut()
            reset()
          }}
          onOpenAdmin={() => {
            setAdminAuthenticated(true)
            go("admin")
          }}
        >
          {homeTab === "availability" ? (
            <AvailabilityTab
              recurringEntries={availability.recurringEntries}
              overrides={availability.overrides}
              slots={slots.slots}
              onViewSlot={(slot) => {
                slots.setActiveSlot(slot)
                go("slot-serving")
              }}
              position={availability.timetablePosition}
              onPositionChange={availability.changePosition}
              onAddRecurring={() => {
                availability.startRecurring()
                go("set-recurring")
              }}
              onAddOverride={() => {
                availability.startOverride()
                go("add-override")
              }}
              onEditRecurring={(e) => {
                availability.startRecurring(e)
                go("set-recurring")
              }}
              onEditOverride={(e) => {
                availability.startOverride(e)
                go("add-override")
              }}
              onRemoveRecurring={availability.removeRecurring}
              onRemoveOverride={availability.removeOverride}
            />
          ) : (
            <SlotList
              slots={slots.slots}
              onSlotTap={(slot) => go(slots.openSlot(slot))}
            />
          )}
        </HomeScreen>
      )

    // ─── Availability ─────────────────────────────────────────────────────────
    case "set-recurring":
      return (
        <SetRecurringScreen
          initial={availability.editingRecurring}
          onSave={(entry) => {
            availability.saveRecurring(entry)
            go("home")
          }}
          onBack={() => go("home")}
        />
      )

    case "add-override":
      return (
        <AddOverrideScreen
          initial={availability.editingOverride}
          onSave={(entry) => {
            availability.saveOverride(entry)
            go("home")
          }}
          onBack={() => go("home")}
        />
      )

    // ─── Open Slots ───────────────────────────────────────────────────────────
    case "slot-volunteer":
      return slots.activeSlot ? (
        <SlotVolunteerScreen
          slot={slots.activeSlot}
          onVolunteer={() => {
            slots.volunteer()
            go("slot-serving")
          }}
          onBack={() => go("home")}
        />
      ) : null

    case "slot-serving":
      return slots.activeSlot ? (
        <SlotServingScreen
          slot={slots.activeSlot}
          onCancelSpot={() => {
            slots.cancelSpot()
            go("home")
          }}
          onBack={() => go("home")}
        />
      ) : null

    case "slot-filled":
      return <SlotFilledScreen onSeeOthers={() => go("home")} />
  }
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
