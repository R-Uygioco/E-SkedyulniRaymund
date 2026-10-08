import { useLayoutEffect, useState } from "react"
import type { Slot } from "../../shared/slot"
import type { SlotsScreen } from "./navigation"
import { SAMPLE_SLOTS } from "./data"
import { isSupabaseConfigured, loadSlots, volunteerForSlot, cancelSlotVolunteer } from "../../integration/supabase"

export function useSlots(groupId?: string) {
  const [slots, setSlots] = useState<Slot[]>(SAMPLE_SLOTS)
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null)

  useLayoutEffect(() => {
    if (!isSupabaseConfigured || !groupId || groupId === "demo") return
    let active = true
    setSlots([])
    loadSlots(groupId).then(data => {
      if (active && data) setSlots(data)
    }).catch(error => console.error("Could not load slots:", error))
    return () => { active = false }
  }, [groupId])

  async function refreshSlots() {
    if (!groupId || groupId === "demo") return
    const data = await loadSlots(groupId)
    if (data) {
      setSlots(data)
      setActiveSlot(current => current ? data.find(slot => slot.id === current.id) ?? current : current)
    }
  }

  return {
    slots,
    activeSlot,
    setActiveSlot,

    /** Selects a slot from the list and returns the screen that matches its status. */
    openSlot(slot: Slot): SlotsScreen {
      setActiveSlot(slot)
      return slot.status === "filled" ? "slot-filled" : slot.status === "serving" ? "slot-serving" : "slot-volunteer"
    },

    async volunteer() {
      if (!activeSlot) return
      if (groupId && groupId !== "demo") {
        await volunteerForSlot(activeSlot.id)
        await refreshSlots()
        return
      }
      setSlots(prev => prev.map(s => s.id === activeSlot.id ? { ...s, status: "serving", filledSpots: s.filledSpots + 1 } : s))
      setActiveSlot(prev => prev ? { ...prev, status: "serving", filledSpots: prev.filledSpots + 1 } : prev)
    },

    async cancelSpot() {
      if (!activeSlot) return
      if (groupId && groupId !== "demo") {
        await cancelSlotVolunteer(activeSlot.id)
        await refreshSlots()
        return
      }
      setSlots(prev => prev.map(s => s.id === activeSlot.id ? { ...s, status: "open", filledSpots: Math.max(0, s.filledSpots - 1) } : s))
    },
  }
}
