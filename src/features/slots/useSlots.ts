import { useState } from "react"
import type { Slot } from "../../shared/slot"
import type { SlotsScreen } from "./navigation"
import { SAMPLE_SLOTS } from "./data"

export function useSlots() {
  const [slots, setSlots] = useState<Slot[]>(SAMPLE_SLOTS)
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null)

  return {
    slots,
    activeSlot,
    setActiveSlot,

    /** Selects a slot from the list and returns the screen that matches its status. */
    openSlot(slot: Slot): SlotsScreen {
      setActiveSlot(slot)
      return slot.status === "filled" ? "slot-filled" : slot.status === "serving" ? "slot-serving" : "slot-volunteer"
    },

    volunteer() {
      if (!activeSlot) return
      setSlots(prev => prev.map(s => s.id === activeSlot.id ? { ...s, status: "serving", filledSpots: s.filledSpots + 1 } : s))
      setActiveSlot(prev => prev ? { ...prev, status: "serving", filledSpots: prev.filledSpots + 1 } : prev)
    },

    cancelSpot() {
      if (!activeSlot) return
      setSlots(prev => prev.map(s => s.id === activeSlot.id ? { ...s, status: "open", filledSpots: Math.max(0, s.filledSpots - 1) } : s))
      setActiveSlot(prev => prev ? { ...prev, status: "open", filledSpots: Math.max(0, prev.filledSpots - 1) } : prev)
    },
  }
}
