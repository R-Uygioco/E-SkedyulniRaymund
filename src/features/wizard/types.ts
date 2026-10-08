export interface FormData {
  name: string
  groupCode: string
  groupName: string
  groupId?: string
  membershipStatus?: "pending" | "approved" | "rejected"
}
