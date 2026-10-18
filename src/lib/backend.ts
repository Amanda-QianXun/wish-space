import type { AppData, ClaimState, Wish } from '../types'
import { supabase } from './supabase'

export async function sendMagicLink(email: string) {
  if (!supabase) throw new Error('Supabase 尚未配置')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function saveNickname(nickname: string) {
  if (!supabase) throw new Error('Supabase 尚未配置')
  const { error } = await supabase.rpc('setup_profile', { p_nickname: nickname })
  if (error) throw error
}

export async function loadAppState(): Promise<AppData & { currentUserId: string; needsProfile?: boolean }> {
  if (!supabase) throw new Error('Supabase 尚未配置')
  const { data, error } = await supabase.rpc('get_app_state')
  if (error) throw error
  return data as AppData & { currentUserId: string; needsProfile?: boolean }
}

export async function createWish(wish: Omit<Wish, 'id' | 'createdAt' | 'ownerId' | 'status'>) {
  if (!supabase) throw new Error('Supabase 尚未配置')
  const { error } = await supabase.rpc('create_wish', { p_payload: wish })
  if (error) throw error
}

export async function createGroup(name: string, emoji: string) {
  if (!supabase) throw new Error('Supabase 尚未配置')
  const { error } = await supabase.rpc('create_group', { p_name: name, p_emoji: emoji })
  if (error) throw error
}

export async function joinGroup(code: string) {
  if (!supabase) throw new Error('Supabase 尚未配置')
  const { error } = await supabase.rpc('join_group', { p_code: code.trim().toUpperCase() })
  if (error) throw error
}

export async function setWishStatus(wishId: string, status: 'active' | 'fulfilled') {
  if (!supabase) throw new Error('Supabase 尚未配置')
  const { error } = await supabase.rpc('set_wish_status', { p_wish_id: wishId, p_status: status })
  if (error) throw error
}

export async function setBirthday(birthday: string) {
  if (!supabase) throw new Error('Supabase 尚未配置')
  const { error } = await supabase.rpc('set_birthday', { p_birthday: birthday })
  if (error) throw error
}

export async function setClaim(wishId: string, groupId: string, state: ClaimState | null) {
  if (!supabase) throw new Error('Supabase 尚未配置')
  const { error } = await supabase.rpc('set_gift_claim', { p_wish_id: wishId, p_group_id: groupId, p_state: state })
  if (error) throw error
}
