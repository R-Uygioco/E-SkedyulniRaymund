import { useCallback, useEffect, useMemo, useState } from "react"

import { apiRequest, getApiErrorMessage } from "../../lib/api"
import type {
  AdminAccountCandidate,
  AdminEvent,
  EventConflictResponse,
  EventDraft,
  JoinRequestStatus,
  Organization,
  OrganizationDraft,
  OrganizationJoinRequest,
  OrganizationMember,
  OrganizationMembership,
  OrganizationSaveResult,
} from "./types"

type AdminBootstrapResponse = {
  organizations: Organization[]
  events: AdminEvent[]
  joinRequests: OrganizationJoinRequest[]
}

// React StrictMode can run effects twice in development. Share concurrent
// bootstrap requests to avoid duplicate initial Admin data loads.
let adminBootstrapPromise: Promise<AdminBootstrapResponse> | null = null

function fetchAdminBootstrap(): Promise<AdminBootstrapResponse> {
  if (adminBootstrapPromise) return adminBootstrapPromise
  const request = apiRequest<AdminBootstrapResponse>("/admin/dashboard/bootstrap")
  adminBootstrapPromise = request
  void request.finally(() => {
    if (adminBootstrapPromise === request) adminBootstrapPromise = null
  }).catch(() => {
    // The caller handles the request error; avoid an unhandled cleanup rejection.
  })
  return request
}

function toEventPayload(draft: EventDraft) {
  return {
    ...draft,
    title: draft.title.trim(),
    location: draft.location.trim(),
    registrationDeadline: draft.registrationDeadline || null,
    repeatUntil: draft.recurrence === "none" ? null : draft.repeatUntil || null,
  }
}

export function useAdmin() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [joinRequests, setJoinRequests] = useState<OrganizationJoinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const refresh = useCallback(async (): Promise<boolean> => {
    setError("")
    try {
      const initialData = await fetchAdminBootstrap()

      setOrganizations(initialData.organizations)
      setEvents(initialData.events)
      setJoinRequests(initialData.joinRequests)
      return true
    } catch (err) {
      setError(getApiErrorMessage(err))
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function saveOrganization(
    draft: OrganizationDraft,
    id?: string,
  ): Promise<OrganizationSaveResult> {
    const duplicate = organizations.some(
      item =>
        item.id !== id &&
        item.name.trim().toLowerCase() === draft.name.trim().toLowerCase(),
    )

    if (duplicate) {
      const message = "An organization with this name already exists."
      setError(message)
      return { ok: false, message }
    }

    try {
      const payload = {
        ...draft,
        name: draft.name.trim(),
        description: draft.description.trim(),
        contactEmail: draft.contactEmail.trim(),
        phone: draft.phone.trim(),
        timezone: draft.timezone.trim(),
        address: draft.address.trim(),
        category: draft.category.trim() || "General",
        joinCode: draft.joinCode.trim() || null,
      }

      const saved = await apiRequest<Organization>(
        id
          ? `/admin/organizations/${encodeURIComponent(id)}`
          : "/admin/organizations",
        {
          method: id ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      )

      await refresh()
      return { ok: true, id: saved.id }
    } catch (err) {
      const message = getApiErrorMessage(err)
      setError(message)
      return { ok: false, message }
    }
  }

  async function toggleOrganization(id: string): Promise<boolean> {
    try {
      await apiRequest<Organization>(
        `/admin/organizations/${encodeURIComponent(id)}/toggle-status`,
        { method: "PATCH" },
      )
      return await refresh()
    } catch (err) {
      setError(getApiErrorMessage(err))
      return false
    }
  }

  async function deleteOrganization(id: string): Promise<boolean> {
    if (events.some(event => event.organizationId === id)) {
      setError("This organization still has events. Delete or move those events first.")
      return false
    }

    try {
      await apiRequest<{ message: string }>(
        `/admin/organizations/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      )
      return await refresh()
    } catch (err) {
      setError(getApiErrorMessage(err))
      return false
    }
  }

  async function regenerateJoinCode(id: string): Promise<string> {
    const organization = await apiRequest<Organization>(
      `/admin/organizations/${encodeURIComponent(id)}/regenerate-join-code`,
      { method: "POST" },
    )
    await refresh()
    return organization.joinCode
  }

  async function saveEvent(draft: EventDraft, id?: string): Promise<string> {
    const saved = await apiRequest<AdminEvent>(
      id
        ? `/admin/events/${encodeURIComponent(id)}`
        : "/admin/events",
      {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(toEventPayload(draft)),
      },
    )
    await refresh()
    return saved.id
  }

  async function duplicateEvent(id: string): Promise<string | null> {
    try {
      const saved = await apiRequest<AdminEvent>(
        `/admin/events/${encodeURIComponent(id)}/duplicate`,
        { method: "POST" },
      )
      await refresh()
      return saved.id
    } catch (err) {
      setError(getApiErrorMessage(err))
      return null
    }
  }

  async function cancelEvent(id: string): Promise<boolean> {
    try {
      await apiRequest<AdminEvent>(
        `/admin/events/${encodeURIComponent(id)}/cancel`,
        { method: "POST" },
      )
      return await refresh()
    } catch (err) {
      setError(getApiErrorMessage(err))
      return false
    }
  }

  async function deleteEvent(id: string): Promise<boolean> {
    try {
      await apiRequest<{ message: string }>(
        `/admin/events/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      )
      return await refresh()
    } catch (err) {
      setError(getApiErrorMessage(err))
      return false
    }
  }

  async function joinOrganization(id: string): Promise<OrganizationMembership> {
    const result = await apiRequest<OrganizationMembership>(
      `/admin/organizations/${encodeURIComponent(id)}/join`,
      { method: "POST" },
    )
    await refresh()
    return result
  }

  async function listOrganizationMembers(id: string): Promise<OrganizationMember[]> {
    try {
      return await apiRequest<OrganizationMember[]>(
        `/admin/organizations/${encodeURIComponent(id)}/members`,
      )
    } catch (err) {
      setError(getApiErrorMessage(err))
      return []
    }
  }

  async function listAssignableAdmins(id: string, query = ""): Promise<AdminAccountCandidate[]> {
    try {
      const params = query.trim() ? `?query=${encodeURIComponent(query.trim())}` : ""
      return await apiRequest<AdminAccountCandidate[]>(
        `/admin/organizations/${encodeURIComponent(id)}/assignable-administrators${params}`,
      )
    } catch (err) {
      setError(getApiErrorMessage(err))
      return []
    }
  }

  async function assignAdministrator(id: string, userId: string): Promise<boolean> {
    try {
      await apiRequest<OrganizationMembership>(
        `/admin/organizations/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,
        { method: "POST" },
      )
      await refresh()
      return true
    } catch (err) {
      setError(getApiErrorMessage(err))
      return false
    }
  }

  async function removeAdministrator(id: string, userId: string): Promise<boolean> {
    try {
      await apiRequest<{ message: string }>(
        `/admin/organizations/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      )
      await refresh()
      return true
    } catch (err) {
      setError(getApiErrorMessage(err))
      return false
    }
  }

  async function reviewJoinRequest(
    id: string,
    decision: Extract<JoinRequestStatus, "approved" | "rejected">,
    note = "",
  ): Promise<boolean> {
    try {
      await apiRequest<OrganizationJoinRequest>(
        `/admin/join-requests/${encodeURIComponent(id)}/decision`,
        {
          method: "PATCH",
          body: JSON.stringify({ decision, note }),
        },
      )
      return await refresh()
    } catch (err) {
      setError(getApiErrorMessage(err))
      return false
    }
  }

  async function deleteJoinRequest(id: string): Promise<boolean> {
    try {
      await apiRequest<{ message: string }>(
        `/admin/join-requests/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      )
      return await refresh()
    } catch (err) {
      setError(getApiErrorMessage(err))
      return false
    }
  }

  async function checkEventConflict(draft: EventDraft, excludeId?: string): Promise<EventConflictResponse> {
    return apiRequest<EventConflictResponse>(
      "/admin/events/conflicts",
      {
        method: "POST",
        body: JSON.stringify({
          ...toEventPayload(draft),
          excludeId: excludeId || null,
        }),
      },
    )
  }

  function findConflict(draft: EventDraft, editingId?: string): AdminEvent | null {
    const start = new Date(draft.startsAt).getTime()
    const end = new Date(draft.endsAt).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null

    return events.find(event => {
      if (event.id === editingId || event.status === "cancelled") return false
      const eventStart = new Date(event.startsAt).getTime()
      const eventEnd = new Date(event.endsAt).getTime()
      if (!Number.isFinite(eventStart) || !Number.isFinite(eventEnd)) return false

      const sameContext =
        event.organizationId === draft.organizationId ||
        (Boolean(event.location.trim()) &&
          event.location.trim().toLowerCase() === draft.location.trim().toLowerCase())

      return sameContext && start < eventEnd && end > eventStart
    }) ?? null
  }

  const metrics = useMemo(() => ({
    activeOrganizations: organizations.filter(item => item.status === "active").length,
    publishedEvents: events.filter(item => item.status === "published").length,
    draftEvents: events.filter(item => item.status === "draft").length,
    upcomingEvents: events.filter(
      item => item.status === "published" && new Date(item.startsAt).getTime() > Date.now(),
    ).length,
    pendingJoinRequests: joinRequests.filter(item => item.status === "pending").length,
  }), [events, joinRequests, organizations])

  return {
    organizations,
    events,
    joinRequests,
    loading,
    error,
    metrics,
    refresh,
    saveOrganization,
    toggleOrganization,
    deleteOrganization,
    regenerateJoinCode,
    saveEvent,
    duplicateEvent,
    cancelEvent,
    deleteEvent,
    joinOrganization,
    listOrganizationMembers,
    listAssignableAdmins,
    assignAdministrator,
    removeAdministrator,
    reviewJoinRequest,
    deleteJoinRequest,
    checkEventConflict,
    findConflict,
  }
}
