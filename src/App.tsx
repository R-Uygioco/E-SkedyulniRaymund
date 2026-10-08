import { useState, useEffect, useRef } from "react"
import { BACK_TARGETS, type Screen } from "./navigation"
import { useIsDesktop } from "./shared/ui"
import { applyStatusBar, listenForBackButton } from "./shared/native"
import { HomeScreen, MINISTRIES, type HomeTab } from "./shared/home"

// Wizard
import { WelcomeScreen, TellNameScreen, JoinGroupScreen, PendingScreen } from "./features/wizard/wizard"
import { DesktopJoinGroupScreen, DesktopPendingScreen } from "./features/wizard/desktop"
import { useWizard } from "./features/wizard/useWizard"

// Availability
import { AvailabilityTab, SetRecurringScreen, AddOverrideScreen } from "./features/availability/availability"
import { useAvailability } from "./features/availability/useAvailability"

// Open Slots
import { SlotList, SlotVolunteerScreen, SlotServingScreen, SlotFilledScreen } from "./features/slots/slots"
import { useSlots } from "./features/slots/useSlots"
import { getMembershipStatus, requestGroupJoin, restoreMember, saveProfile } from "./integration/supabase"

export default function App() {
  const isDesktop = useIsDesktop()
  const [screen, setScreen] = useState<Screen>("welcome")
  const [prevScreen, setPrevScreen] = useState<Screen>("welcome")

  const [homeTab, setHomeTab] = useState<HomeTab>("availability")
  const [ministry, setMinistry] = useState(MINISTRIES[0])

  const wizard = useWizard()
  const approvedGroupId = wizard.form.membershipStatus === "approved" ? wizard.form.groupId : undefined
  const availability = useAvailability(approvedGroupId)
  const slots = useSlots(approvedGroupId)

  function go(to: Screen) {
    setPrevScreen(screen)
    setScreen(to)
  }

  function reset() {
    wizard.reset()
    setHomeTab("availability")
    setMinistry(MINISTRIES[0])
    availability.resetPosition()
    go("welcome")
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
    applyStatusBar(screen)
  }, [screen])

  useEffect(() => {
    let active = true
    restoreMember().then(restored => {
      if (!active || !restored) return
      wizard.updateForm({
        name: restored.name,
        groupCode: restored.membership?.code ?? "",
        groupName: restored.membership?.name ?? "",
        groupId: restored.membership?.id,
        membershipStatus: restored.membership?.status,
      })
      if (!restored.membership) {
        setScreen("join-group")
      } else {
        setMinistry({ id: restored.membership.id, name: restored.membership.name, parish: "Your Ministry" })
        setScreen(restored.membership.status === "approved" ? "home" : "pending")
      }
    }).catch(error => console.error("Could not restore member session:", error))
    return () => { active = false }
  }, [])

  // Android back button support (only active inside the Android app).
  const screenRef = useRef(screen)
  screenRef.current = screen
  const prevScreenRef = useRef(prevScreen)
  prevScreenRef.current = prevScreen
  const goRef = useRef(go)
  goRef.current = go
  useEffect(() => listenForBackButton(BACK_TARGETS, () => screenRef.current, () => prevScreenRef.current, to => goRef.current(to)), [])

  switch (screen) {
    // ─── Wizard ───────────────────────────────────────────────────────────────
    case "welcome":
      return <WelcomeScreen onStart={() => go("tell-name")} />

    case "tell-name":
      return (
        <TellNameScreen
          firstName={wizard.firstName}
          lastName={wizard.lastName}
          setFirstName={wizard.setFirstName}
          setLastName={wizard.setLastName}
          onContinue={async () => {
            wizard.saveName()
            await saveProfile(`${wizard.firstName} ${wizard.lastName}`.trim())
            go("join-group")
          }}
        />
      )

    case "join-group": {
      // Back returns to wherever the member came from: name entry during onboarding, or Home via "+ Join Another Ministry".
      const back = () => go(prevScreen)
      return isDesktop ? (
        <DesktopJoinGroupScreen data={wizard.form} setData={wizard.updateForm} onJoin={async code => {
          const membership = await requestGroupJoin(code)
          wizard.updateForm({ groupCode: membership.code, groupName: membership.name, groupId: membership.id, membershipStatus: membership.status })
          go("pending")
        }} onBack={back} />
      ) : (
        <JoinGroupScreen data={wizard.form} setData={wizard.updateForm} onJoin={async code => {
          const membership = await requestGroupJoin(code)
          wizard.updateForm({ groupCode: membership.code, groupName: membership.name, groupId: membership.id, membershipStatus: membership.status })
          go("pending")
        }} onBack={back} />
      )
    }

    case "pending":
      return isDesktop ? (
        <DesktopPendingScreen data={wizard.form} onBack={reset} onApproved={async () => {
          const status = wizard.form.groupId ? await getMembershipStatus(wizard.form.groupId) : "approved"
          wizard.updateForm({ membershipStatus: status })
          if (status === "rejected") throw new Error("Your request was not approved. Please contact the group leader.")
          if (status !== "approved") return false
          setMinistry({ id: wizard.form.groupId ?? "demo", name: wizard.form.groupName, parish: "Your Ministry" })
          go("home")
          return true
        }} />
      ) : (
        <PendingScreen data={wizard.form} onBack={reset} onApproved={async () => {
          const status = wizard.form.groupId ? await getMembershipStatus(wizard.form.groupId) : "approved"
          wizard.updateForm({ membershipStatus: status })
          if (status === "rejected") throw new Error("Your request was not approved. Please contact the group leader.")
          if (status !== "approved") return false
          setMinistry({ id: wizard.form.groupId ?? "demo", name: wizard.form.groupName, parish: "Your Ministry" })
          go("home")
          return true
        }} />
      )

    // ─── Home (holds the Availability and Open Slots tabs) ────────────────────
    case "home":
      return (
        <HomeScreen
          userName={wizard.form.name || "Maria Santos"}
          ministry={ministry}
          onMinistryChange={setMinistry}
          tab={homeTab}
          onTabChange={setHomeTab}
          onJoin={() => go("join-group")}
        >
          {homeTab === "availability" ? (
            <AvailabilityTab
              recurringEntries={availability.recurringEntries}
              overrides={availability.overrides}
              assignments={availability.assignments}
              slots={slots.slots}
              onViewSlot={slot => { slots.setActiveSlot(slot); go("slot-serving") }}
              position={availability.timetablePosition}
              onPositionChange={availability.changePosition}
              onAddRecurring={() => { availability.startRecurring(); go("set-recurring") }}
              onAddOverride={() => { availability.startOverride(); go("add-override") }}
              onEditRecurring={e => { availability.startRecurring(e); go("set-recurring") }}
              onEditOverride={e => { availability.startOverride(e); go("add-override") }}
              onRemoveRecurring={availability.removeRecurring}
              onRemoveOverride={availability.removeOverride}
            />
          ) : (
            <SlotList slots={slots.slots} onSlotTap={slot => go(slots.openSlot(slot))} />
          )}
        </HomeScreen>
      )

    // ─── Availability ─────────────────────────────────────────────────────────
    case "set-recurring":
      return (
        <SetRecurringScreen
          initial={availability.editingRecurring}
          onSave={entry => { availability.saveRecurring(entry); go("home") }}
          onBack={() => go("home")}
        />
      )

    case "add-override":
      return (
        <AddOverrideScreen
          initial={availability.editingOverride}
          onSave={entry => { availability.saveOverride(entry); go("home") }}
          onBack={() => go("home")}
        />
      )

    // ─── Open Slots ───────────────────────────────────────────────────────────
    case "slot-volunteer":
      return slots.activeSlot ? (
        <SlotVolunteerScreen
          slot={slots.activeSlot}
          onVolunteer={async () => { await slots.volunteer(); go("slot-serving") }}
          onBack={() => go("home")}
        />
      ) : null

    case "slot-serving":
      return slots.activeSlot ? (
        <SlotServingScreen
          slot={slots.activeSlot}
          onCancelSpot={async () => { await slots.cancelSpot(); go("home") }}
          onBack={() => go("home")}
        />
      ) : null

    case "slot-filled":
      return <SlotFilledScreen onSeeOthers={() => go("home")} />
  }
}
