import { useLayoutEffect, useState } from "react"
import type { RecurringAvail, OneTimeOverride, AvailEditTarget, TimetablePosition } from "./types"
import { INITIAL_RECURRING, INITIAL_OVERRIDES } from "./data"
import { getMyAssignments, type Assignment } from "../../integration/assignments"
import { isSupabaseConfigured, loadAssignments, loadAvailability, removeAvailability, saveAvailability } from "../../integration/supabase"

// This week, on today. Phones start on the one-day view (big and easy to read); tablets and computers show the whole week.
function initialTimetablePosition(): TimetablePosition {
  return {
    weekOffset: 0,
    view: window.matchMedia("(min-width: 640px)").matches ? "week" : "day",
    dayIndex: (new Date().getDay() + 6) % 7,
  }
}

export function useAvailability(groupId?: string) {
  const [recurringEntries, setRecurringEntries] = useState<RecurringAvail[]>(INITIAL_RECURRING)
  const [overrides, setOverrides] = useState<OneTimeOverride[]>(INITIAL_OVERRIDES)
  const [assignments, setAssignments] = useState<Assignment[]>(getMyAssignments())
  const [editTarget, setEditTarget] = useState<AvailEditTarget | null>(null)
  // Kept here so the timetable shows the same week and view after an add/edit screen.
  const [timetablePosition, setTimetablePosition] = useState(initialTimetablePosition)

  useLayoutEffect(() => {
    if (!isSupabaseConfigured || !groupId || groupId === "demo") return
    let active = true
    setRecurringEntries([])
    setOverrides([])
    setAssignments([])
    loadAvailability(groupId).then(data => {
      if (!active || !data) return
      setRecurringEntries(data.recurring)
      setOverrides(data.overrides)
    }).catch(error => console.error("Could not load availability:", error))
    loadAssignments(groupId).then(data => {
      if (active && data) setAssignments(data)
    }).catch(error => console.error("Could not load assigned schedules:", error))
    return () => { active = false }
  }, [groupId])

  return {
    recurringEntries,
    overrides,
    assignments,
    timetablePosition,
    editingRecurring: editTarget?.kind === "recurring" ? editTarget.entry : undefined,
    editingOverride: editTarget?.kind === "override" ? editTarget.entry : undefined,

    changePosition(change: Partial<TimetablePosition>) {
      setTimetablePosition(current => ({ ...current, ...change }))
    },
    resetPosition() {
      setTimetablePosition(initialTimetablePosition())
    },

    /** Pass an entry to edit it, or nothing to add a new one. */
    startRecurring(entry?: RecurringAvail) {
      setEditTarget(entry ? { kind: "recurring", entry } : null)
    },
    startOverride(entry?: OneTimeOverride) {
      setEditTarget(entry ? { kind: "override", entry } : null)
    },

    saveRecurring(entry: RecurringAvail) {
      setRecurringEntries(prev =>
        prev.find(e => e.id === entry.id) ? prev.map(e => e.id === entry.id ? entry : e) : [...prev, entry]
      )
      if (groupId && groupId !== "demo") void saveAvailability(groupId, entry).catch(error => console.error("Could not save recurring availability:", error))
    },
    saveOverride(entry: OneTimeOverride) {
      setOverrides(prev =>
        prev.find(e => e.id === entry.id) ? prev.map(e => e.id === entry.id ? entry : e) : [...prev, entry]
      )
      if (groupId && groupId !== "demo") void saveAvailability(groupId, entry).catch(error => console.error("Could not save availability override:", error))
    },

    removeRecurring(id: string) {
      setRecurringEntries(prev => prev.filter(e => e.id !== id))
      if (groupId && groupId !== "demo") void removeAvailability(groupId, id, "recurring").catch(error => console.error("Could not remove recurring availability:", error))
    },
    removeOverride(id: string) {
      setOverrides(prev => prev.filter(e => e.id !== id))
      if (groupId && groupId !== "demo") void removeAvailability(groupId, id, "override").catch(error => console.error("Could not remove availability override:", error))
    },
  }
}
