import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const hasSupabase = Boolean(url && key)
export const supabase = hasSupabase ? createClient(url!, key!) : null
