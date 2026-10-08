import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { RecurringAvail, OneTimeOverride } from "../features/availability/types"
import type { Slot } from "../shared/slot"
import type { Assignment } from "./assignments"
import { EXAMPLE_GROUPS } from "../features/wizard/data"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

const client: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

const ACTIVE_GROUP_KEY = "eskedyul.activeGroup"

export type Membership = { id: string; name: string; code: string; status: "pending" | "approved" | "rejected" }

async function ensureUser() {
  if (!client) return null
  const { data: { session }, error: sessionError } = await client.auth.getSession()
  if (sessionError) throw sessionError
  if (session?.user) return session.user.id
  const { data, error } = await client.auth.signInAnonymously()
  if (error) throw error
  if (!data.user) throw new Error("Could not create an anonymous member session.")
  return data.user.id
}

export async function restoreMember(): Promise<{ name: string; membership: Membership | null } | null> {
  if (!client) return null
  const { data: { session }, error: sessionError } = await client.auth.getSession()
  if (sessionError) throw sessionError
  if (!session) return null
  const userId = session.user.id
  const [{ data: profile, error: profileError }, { data: member, error: memberError }] = await Promise.all([
    client.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    client.from("group_members").select("status, groups(id, name, code)").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ])
  if (profileError) throw profileError
  if (memberError) throw memberError
  if (!profile?.full_name) return null
  if (!member?.groups) return { name: profile.full_name, membership: null }
  const group = member.groups as unknown as { id: string; name: string; code: string }
  const membership = { ...group, status: member.status as Membership["status"] }
  localStorage.setItem(ACTIVE_GROUP_KEY, JSON.stringify(membership))
  return { name: profile.full_name, membership }
}

export async function saveProfile(fullName: string) {
  if (!client) return
  const userId = await ensureUser()
  if (!userId) return
  const { error } = await client.from("profiles").upsert({ id: userId, full_name: fullName, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function requestGroupJoin(code: string): Promise<Membership> {
  if (!client) {
    const name = EXAMPLE_GROUPS[code]
    if (!name) throw new Error("We couldn't find a group with that code. Please check with your group leader and try again.")
    return { id: "demo", name, code, status: "pending" }
  }
  await ensureUser()
  const { data, error } = await client.rpc("join_group_by_code", { group_code: code }).single()
  if (error) throw new Error(error.message.includes("group_not_found")
    ? "We couldn't find a group with that code. Please check with your group leader and try again."
    : error.message)
  const result = data as { joined_group_id: string; joined_group_name: string; membership_status: Membership["status"] } | null
  if (!result) throw new Error("The group request returned no membership details.")
  const membership: Membership = { id: result.joined_group_id, name: result.joined_group_name, code, status: result.membership_status }
  localStorage.setItem(ACTIVE_GROUP_KEY, JSON.stringify(membership))
  return membership
}

export async function getMembershipStatus(groupId: string): Promise<Membership["status"]> {
  if (!client || groupId === "demo") return "approved"
  const { data, error } = await client.from("group_members").select("status").eq("group_id", groupId).maybeSingle()
  if (error) throw error
  return (data?.status ?? "pending") as Membership["status"]
}

function currentGroupId(groupId: string) {
  return client && groupId !== "demo" ? groupId : null
}

export async function loadAvailability(groupId: string) {
  if (!client || !currentGroupId(groupId)) return null
  const [{ data: rules, error: rulesError }, { data: overrides, error: overridesError }] = await Promise.all([
    client.from("availability_rules").select("id, days, start_time, end_time").eq("group_id", groupId),
    client.from("availability_overrides").select("id, date, type, start_time, end_time").eq("group_id", groupId),
  ])
  if (rulesError) throw rulesError
  if (overridesError) throw overridesError
  return {
    recurring: (rules ?? []).map(row => ({ id: row.id, days: row.days, startTime: row.start_time.slice(0, 5), endTime: row.end_time.slice(0, 5) })) as RecurringAvail[],
    overrides: (overrides ?? []).map(row => ({ id: row.id, date: row.date, type: row.type, startTime: row.start_time?.slice(0, 5), endTime: row.end_time?.slice(0, 5) })) as OneTimeOverride[],
  }
}

export async function saveAvailability(groupId: string, entry: RecurringAvail | OneTimeOverride) {
  if (!client || !currentGroupId(groupId)) return
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error("Your session has expired. Please restart the app.")
  if ("days" in entry) {
    const { error } = await client.from("availability_rules").upsert({
      id: entry.id, group_id: groupId, user_id: user.id, days: entry.days,
      start_time: entry.startTime, end_time: entry.endTime,
    })
    if (error) throw error
  } else {
    const { error } = await client.from("availability_overrides").upsert({
      id: entry.id, group_id: groupId, user_id: user.id, date: entry.date, type: entry.type,
      start_time: entry.startTime ?? null, end_time: entry.endTime ?? null,
    })
    if (error) throw error
  }
}

export async function removeAvailability(groupId: string, id: string, kind: "recurring" | "override") {
  if (!client || !currentGroupId(groupId)) return
  const table = kind === "recurring" ? "availability_rules" : "availability_overrides"
  const { error } = await client.from(table).delete().eq("id", id).eq("group_id", groupId)
  if (error) throw error
}

export async function loadSlots(groupId: string): Promise<Slot[] | null> {
  if (!client || !currentGroupId(groupId)) return null
  const { data, error } = await client.rpc("list_group_slots", { target_group: groupId })
  if (error) throw error
  type SlotRow = {
    slot_id: string
    slot_date: string
    slot_time: string
    slot_label: string
    spot_limit: number
    spots_filled: number
    member_volunteering: boolean
  }
  return (data as SlotRow[]).map(row => {
    const date = row.slot_date
    const time24 = row.slot_time.slice(0, 5)
    const [hour, minute] = time24.split(":").map(Number)
    const time = `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`
    const cutoff = new Date(`${date}T${time24}:00`)
    return {
      id: row.slot_id, date, time, massName: row.slot_label, totalSpots: row.spot_limit,
      filledSpots: Number(row.spots_filled), status: row.member_volunteering ? "serving" : Number(row.spots_filled) >= row.spot_limit ? "filled" : "open",
      withinCutoff: cutoff.getTime() >= Date.now() && cutoff.getTime() - Date.now() < 48 * 60 * 60 * 1000,
    } satisfies Slot
  })
}

export async function volunteerForSlot(slotId: string) {
  if (!client || slotId.startsWith("s")) return
  const { error } = await client.rpc("volunteer_for_slot", { target_slot: slotId })
  if (error) throw error
}

export async function cancelSlotVolunteer(slotId: string) {
  if (!client || slotId.startsWith("s")) return
  const { error } = await client.rpc("cancel_slot_volunteer", { target_slot: slotId })
  if (error) throw error
}

export async function loadAssignments(groupId: string): Promise<Assignment[] | null> {
  if (!client || !currentGroupId(groupId)) return null
  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error("Your session has expired. Please restart the app.")
  const { data, error } = await client.from("assignments").select("id, date, start_time, mass_name, role")
    .eq("group_id", groupId).eq("user_id", user.id).order("date").order("start_time")
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id,
    date: row.date,
    time: row.start_time.slice(0, 5),
    massName: row.mass_name,
    role: row.role,
  }))
}