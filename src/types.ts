export type WishKind = 'inspiration' | 'exact'
export type WishStatus = 'active' | 'fulfilled'
export type ClaimState = 'reserved' | 'purchased'

export interface Profile {
  id: string
  nickname: string
  color: string
  birthday?: string
}

export interface Group {
  id: string
  name: string
  emoji: string
  inviteCode: string
  members: Profile[]
}

export interface GroupOverride {
  groupId: string
  platform?: string
  url?: string
  price?: number
  note?: string
}

export interface Wish {
  id: string
  ownerId: string
  title: string
  kind: WishKind
  status: WishStatus
  priority: number
  category: string
  budgetMin?: number
  budgetMax?: number
  platform?: string
  price?: number
  url?: string
  note?: string
  styleNote?: string
  image?: string
  groupIds: string[]
  overrides?: GroupOverride[]
  createdAt: string
}

export interface GiftClaim {
  wishId: string
  groupId: string
  claimedBy: string
  state: ClaimState
}

export interface AppData {
  profiles: Profile[]
  groups: Group[]
  wishes: Wish[]
  claims: GiftClaim[]
}
