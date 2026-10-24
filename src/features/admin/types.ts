export type OrganizationStatus = "active" | "inactive"
export type EventStatus = "draft" | "published" | "cancelled" | "completed"
export type EventVisibility = "public" | "members"
export type Recurrence = "none" | "weekly" | "monthly"
export type JoinRequestStatus = "pending" | "approved" | "rejected"

export type Organization = {
  id: string
  name: string
  description: string
  contactEmail: string
  phone: string
  timezone: string
  address: string
  category: string
  status: OrganizationStatus
  joinCode: string
  createdAt: string
}

export type OrganizationDraft = Omit<Organization, "id" | "createdAt">

export type AdminEvent = {
  id: string
  organizationId: string
  title: string
  description: string
  startsAt: string
  endsAt: string
  location: string
  capacity: number
  registrationDeadline: string
  visibility: EventVisibility
  recurrence: Recurrence
  repeatUntil: string
  status: EventStatus
  createdAt: string
}

export type EventDraft = Omit<AdminEvent, "id" | "createdAt">

export type EventConflictResponse = {
  conflict: boolean
  event: AdminEvent | null
}

export type OrganizationMembership = {
  organizationId: string
  organizationName: string
  userId: string
  joinedAt: string
  message: string
}

export type OrganizationMember = {
  organizationId: string
  organizationName: string
  userId: string
  username: string
  email: string
  fullName: string
  joinedAt: string
  message: string
}

export type AdminAccountCandidate = {
  userId: string
  username: string
  email: string
  fullName: string
}

export type OrganizationJoinRequest = {
  id: string
  organizationId: string
  organizationName: string
  memberName: string
  submittedJoinCode: string
  status: JoinRequestStatus
  requestedAt: string
  reviewedAt: string | null
  reviewerNote: string
  message: string
}

export type PublicJoinRequestStatus = {
  id: string
  organizationName: string
  status: JoinRequestStatus
  requestedAt: string
  reviewedAt: string | null
  reviewerNote: string
  message: string
}

export type OrganizationSaveResult =
  | { ok: true; id: string }
  | { ok: false; message: string }
