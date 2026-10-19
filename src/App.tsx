import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, ArrowUpDown, Bell, Cake, CalendarDays, Cat, Check, ChevronDown, ChevronLeft, ChevronRight, Dog, Gift, Heart, Home, ImagePlus, Link2, LockKeyhole,
  LogOut, MoreHorizontal, PackageCheck, Pencil, Plus, Rabbit, SlidersHorizontal, Sparkles, Star, Trash2, UserRound, Users, X,
} from 'lucide-react'
import { demoData } from './data/demo'
import { hasSupabase, supabase } from './lib/supabase'
import * as backend from './lib/backend'
import type { AppData, ClaimState, Group, Profile, Wish, WishKind } from './types'

// 本原型中的用户姓名、生日、群组和通知内容均为虚构演示信息。

type Tab = 'groups' | 'add' | 'me'
type Modal = 'group-menu' | 'group-detail' | 'group-create' | 'group-join' | 'filters' | null
type SortMode = 'newest' | 'oldest' | 'priority-desc' | 'priority-asc' | 'budget-desc' | 'budget-asc'

interface Filters {
  category: string
  kind: 'all' | WishKind
  budgetMax: number | null
  priorityMin: number
}

const STORE_KEY = 'wish-space-demo-v1'
const USER_KEY = 'wish-space-demo-user'

function cloneDemo(): AppData {
  return JSON.parse(JSON.stringify(demoData)) as AppData
}

function getStoredData() {
  try {
    const value = localStorage.getItem(STORE_KEY)
    if (!value) return cloneDemo()
    const stored = JSON.parse(value) as AppData
    return {
      ...stored,
      profiles: stored.profiles.map(profile => profile.id === 'u2' ? { ...profile, nickname: '小猫' } : profile),
      groups: stored.groups.map(group => ({ ...group, members: group.members.map(member => member.id === 'u2' ? { ...member, nickname: '小猫' } : member) })),
      wishes: stored.wishes.map(wish => ({
        ...wish,
        image: demoData.wishes.find(item => item.id === wish.id)?.image || wish.image,
      })),
    }
  } catch { return cloneDemo() }
}

const categories = ['全部', '生活好物', '家居', '穿搭', '数码', '书影音', '体验', '其他']

function birthdayParts(value?: string) {
  if (!value) return null
  const match = value.match(/^(?:\d{4}-)?(\d{2})-(\d{2})$/)
  return match ? { month: Number(match[1]), day: Number(match[2]) } : null
}

function nextBirthday(value?: string) {
  const parts = birthdayParts(value)
  if (!parts) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let date = new Date(now.getFullYear(), parts.month - 1, parts.day)
  if (date < today) date = new Date(now.getFullYear() + 1, parts.month - 1, parts.day)
  const days = Math.round((date.getTime() - today.getTime()) / 86400000)
  return { date, days, label: `${parts.month}月${String(parts.day).padStart(2, '0')}日` }
}

function sortedBirthdays(members: Profile[]) {
  return members.map(member => ({ member, next: nextBirthday(member.birthday) }))
    .filter((item): item is { member: Profile; next: NonNullable<ReturnType<typeof nextBirthday>> } => Boolean(item.next))
    .sort((a, b) => a.next.days - b.next.days)
}

function wishMatches(wish: Wish, filters: Filters) {
  if (filters.category !== '全部' && wish.category !== filters.category) return false
  if (filters.kind !== 'all' && wish.kind !== filters.kind) return false
  if (filters.priorityMin > 1 && wish.priority < filters.priorityMin) return false
  if (filters.budgetMax !== null) {
    const amount = wish.kind === 'exact' ? wish.price : wish.budgetMin
    if (amount && amount > filters.budgetMax) return false
  }
  return true
}

function wishAmount(wish: Wish) {
  return wish.kind === 'exact' ? (wish.price || 0) : (wish.budgetMax || wish.budgetMin || 0)
}

function sortWishes(wishes: Wish[], mode: SortMode) {
  return [...wishes].sort((a, b) => {
    if (mode === 'priority-desc') return b.priority - a.priority
    if (mode === 'priority-asc') return a.priority - b.priority
    if (mode === 'budget-desc') return wishAmount(b) - wishAmount(a)
    if (mode === 'budget-asc') return wishAmount(a) - wishAmount(b)
    const dateDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    return mode === 'oldest' ? -dateDiff : dateDiff
  })
}

function formatWishDate(value: string) {
  const date = new Date(value)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function readWishImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('请选择图片文件')); return }
    if (file.size > 8 * 1024 * 1024) { reject(new Error('图片请控制在 8MB 以内')); return }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.onload = () => {
      const source = String(reader.result)
      const picture = new Image()
      picture.onerror = () => reject(new Error('图片读取失败'))
      picture.onload = () => {
        const maxSide = 1200
        const scale = Math.min(1, maxSide / Math.max(picture.width, picture.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(picture.width * scale))
        canvas.height = Math.max(1, Math.round(picture.height * scale))
        const context = canvas.getContext('2d')
        if (!context) { reject(new Error('图片处理失败')); return }
        context.drawImage(picture, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/webp', .82))
      }
      picture.src = source
    }
    reader.readAsDataURL(file)
  })
}

function SortControl({ value, onChange }: { value: SortMode; onChange: (value: SortMode) => void }) {
  const criterion = value === 'newest' || value === 'oldest' ? 'time' : value.startsWith('priority') ? 'priority' : 'budget'
  const ascending = value === 'oldest' || value.endsWith('-asc')
  const changeCriterion = (next: string) => onChange(next === 'time' ? (ascending ? 'oldest' : 'newest') : `${next}-${ascending ? 'asc' : 'desc'}` as SortMode)
  const toggleDirection = () => onChange(criterion === 'time' ? (ascending ? 'newest' : 'oldest') : `${criterion}-${ascending ? 'desc' : 'asc'}` as SortMode)
  return <div className="sort-control"><button type="button" className="sort-direction" onClick={toggleDirection} aria-label={ascending ? '当前正序，切换为倒序' : '当前倒序，切换为正序'} title={ascending ? '正序' : '倒序'}><ArrowUpDown size={18} /></button><select aria-label="心愿排序" value={criterion} onChange={event => changeCriterion(event.target.value)}><option value="time">时间</option><option value="priority">优先级</option><option value="budget">预算</option></select></div>
}

function Avatar({ profile, size = 'md' }: { profile: Profile; size?: 'sm' | 'md' | 'lg' }) {
  const Animal = profile.id === 'u1' ? Cat : profile.id === 'u2' ? Dog : profile.id === 'u3' ? Rabbit : UserRound
  return (
    <span className={`avatar avatar-${size}`} style={{ background: profile.color }} title={profile.nickname}>
      <Animal aria-hidden="true" />
    </span>
  )
}

function Stars({ value, editable, onChange }: { value: number; editable?: boolean; onChange?: (v: number) => void }) {
  return <span className="stars" aria-label={`${value}星优先级`}>
    {[1, 2, 3, 4, 5].map(n => (
      <button key={n} type="button" className={editable ? 'star-button' : 'star-static'} onClick={() => editable && onChange?.(n)}>
        <Star size={editable ? 23 : 13} fill={n <= value ? 'currentColor' : 'none'} />
      </button>
    ))}
  </span>
}

function AuthScreen({ onDemo }: { onDemo: () => void }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try { await backend.sendMagicLink(email); setSent(true) }
    catch (err) { setError(err instanceof Error ? err.message : '发送失败，请稍后重试') }
    finally { setLoading(false) }
  }
  return <main className="auth-shell">
    <section className="auth-card">
      <div className="logo-orb"><Gift size={32} /></div>
      <h1>把想要的说得刚刚好</h1>
      <p className="auth-lead">让朋友更懂你的心愿，也让每一份礼物更接近心意。</p>
      {sent ? <div className="notice success"><Sparkles size={18} /><span>登录链接已发送至 <b>{email}</b>，请前往邮箱查收。</span></div> :
        <form onSubmit={submit} className="auth-form">
          <label>邮箱地址<input required type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary full" disabled={loading}>{loading ? '正在发送…' : '用邮箱登录'}</button>
        </form>}
      <div className="auth-divider"><span>或者</span></div>
      <button className="secondary full" onClick={onDemo}>先体验产品</button>
      <p className="tiny">登录即表示你同意仅将心愿分享给自己选择的群组。</p>
    </section>
  </main>
}

function ProfileSetup({ onDone }: { onDone: () => void }) {
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true)
    try { await backend.saveNickname(nickname.trim()); onDone() }
    finally { setLoading(false) }
  }
  return <main className="auth-shell"><form className="auth-card" onSubmit={submit}>
    <div className="logo-orb"><Heart size={30} /></div>
    <h1>朋友怎么称呼你？</h1>
    <p className="auth-lead">昵称会显示在你加入的群组和发布的心愿旁。</p>
    <label>专属昵称<input required maxLength={16} value={nickname} onChange={e => setNickname(e.target.value)} placeholder="例如：小鹿" /></label>
    <button className="primary full" disabled={!nickname.trim() || loading}>进入心愿空间</button>
  </form></main>
}

function WishCard({ wish, owner, claim, isOwner, onOpen, onOwnerOpen }: { wish: Wish; owner: Profile; claim?: ClaimState; isOwner: boolean; onOpen: () => void; onOwnerOpen?: () => void }) {
  const price = wish.kind === 'exact' && wish.price ? `¥${wish.price}` : wish.budgetMin || wish.budgetMax
    ? `¥${wish.budgetMin ?? 0}–${wish.budgetMax ?? '不限'}` : '预算不限'
  return <article className="wish-card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onOpen() }}>
    <div className={`wish-image${wish.image ? '' : ' wish-image-placeholder'}`} style={{ backgroundImage: wish.image ? `url(${wish.image})` : undefined }}>
      {!wish.image && <Gift className="placeholder-gift" aria-hidden="true" />}
      <span className={`kind-badge ${wish.kind}`}>{wish.kind === 'exact' ? '具体商品' : '心愿灵感'}</span>
      {!isOwner && claim && <span className="claim-badge"><LockKeyhole size={12} />{claim === 'purchased' ? '已买好' : '已认领'}</span>}
    </div>
    <div className="wish-content">
      <div className="wish-owner">{onOwnerOpen ? <button type="button" className="card-avatar-link" aria-label={`进入${owner.nickname}的心愿空间`} onClick={event => { event.stopPropagation(); onOwnerOpen() }}><Avatar profile={owner} size="sm" /></button> : <Avatar profile={owner} size="sm" />}<span>{owner.nickname}</span><span className="wish-category-label">{wish.category}</span><span className="wish-date">{formatWishDate(wish.createdAt)}</span></div>
      <h3>{wish.title}</h3>
      {(wish.note || wish.styleNote) && <p>{wish.note || wish.styleNote}</p>}
      <div className="wish-meta"><span className="price">{price}</span><Stars value={wish.priority} /></div>
    </div>
  </article>
}

function WishDetail({ wish, owner, group, sharedGroups, user, claim, onClose, onClaim, onFulfill, onDelete, onEdit, onOwnerOpen }: {
  wish: Wish; owner: Profile; group: Group; user: Profile; claim?: ClaimState;
  sharedGroups: Group[]; onClose: () => void; onClaim: (state: ClaimState | null) => void; onFulfill: () => void; onDelete: () => void; onEdit: () => void; onOwnerOpen: () => void
}) {
  const isOwner = wish.ownerId === user.id
  const override = wish.overrides?.find(o => o.groupId === group.id)
  const note = override?.note || wish.note
  return <div className="sheet-backdrop" onMouseDown={onClose}><article className={`detail-sheet${wish.image ? '' : ' no-image'}`} onMouseDown={e => e.stopPropagation()}>
    <div className="sheet-handle" /><button className="sheet-close" onClick={onClose}><X /></button>
    <div className={`detail-image${wish.image ? '' : ' detail-image-placeholder'}`} style={{ backgroundImage: wish.image ? `url(${wish.image})` : undefined }}>{!wish.image && <Gift aria-hidden="true" />}</div>
    <div className="detail-body">
      <div className="detail-owner-row"><div className="detail-owner">{isOwner ? <Avatar profile={owner} /> : <button type="button" className="detail-avatar-link" aria-label={`进入${owner.nickname}的心愿空间`} onClick={onOwnerOpen}><Avatar profile={owner} /></button>}<span>{isOwner ? '我的心愿' : `${owner.nickname}的心愿`}</span><span className={`kind-badge ${wish.kind}`}>{wish.kind === 'exact' ? '具体商品' : '心愿灵感'}</span></div><Stars value={wish.priority} /></div>
      <div className="detail-title-row"><h2>{wish.title}</h2>{isOwner && <button className="edit-wish-button" onClick={onEdit} aria-label="编辑心愿"><Pencil size={17} /></button>}</div>
      <div className="wish-created-at">{formatWishDate(wish.createdAt)}</div>
      <div className="detail-grid">
        <div><small>{wish.kind === 'exact' ? '参考价格' : '预算范围'}</small><b>{wish.kind === 'exact' ? (override?.price || wish.price ? `¥${override?.price ?? wish.price}` : '未填写') : `¥${wish.budgetMin ?? 0}–${wish.budgetMax ?? '不限'}`}</b></div>
        <div><small>类别</small><b>{wish.category}</b></div>
      </div>
      {wish.styleNote && <section className="detail-note"><small>喜欢什么样的</small><p>{wish.styleNote}</p></section>}
      {note && <section className="detail-note"><small>补充说明</small><p>{note}</p></section>}
      {(override?.url || wish.url) && <a className="product-link" href={override?.url || wish.url} target="_blank" rel="noreferrer"><Link2 size={18} /><span>{override?.platform || wish.platform || '查看商品参考'}</span></a>}
      {isOwner && <section className="shared-groups"><small>分享至</small><div>{sharedGroups.map(item => <span key={item.id}><i>{item.emoji}</i>{item.name}</span>)}</div></section>}
      {isOwner ? <div className="owner-state owner-state-minimal">
        <button className="text-button" onClick={onFulfill}>{wish.status === 'fulfilled' ? '重新开启' : '标记实现'}</button>
        <button className="delete-wish-button" onClick={onDelete}><Trash2 size={15} />删除心愿</button>
      </div> : <section className="claim-panel claim-panel-compact">
        {!claim ? <button className="primary full" onClick={() => onClaim('reserved')}><Gift size={18} />秘密认领</button> :
          <div className="claim-actions">
            <button className={claim === 'purchased' ? 'primary' : 'secondary'} onClick={() => onClaim('purchased')}><PackageCheck size={18} />{claim === 'purchased' ? '已购买' : '标记已购买'}</button>
            <button className="ghost-danger" onClick={() => onClaim(null)}>取消认领</button>
          </div>}
      </section>}
    </div>
  </article></div>
}

function MemberView({ member, group, wishes, claims, currentUser, filters, sort, onSort, onFilters, onBack, onOpenWish }: {
  member: Profile; group: Group; wishes: Wish[]; claims: AppData['claims']; currentUser: Profile; filters: Filters;
  sort: SortMode; onSort: (value: SortMode) => void; onFilters: () => void; onBack: () => void; onOpenWish: (id: string) => void
}) {
  const birthday = nextBirthday(member.birthday)
  const filtered = sortWishes(wishes.filter(w => w.ownerId === member.id && w.groupIds.includes(group.id) && w.status === 'active' && wishMatches(w, filters)), sort)
  return <section className="page member-page">
    <header className="simple-header"><button className="icon-button" onClick={onBack}><ArrowLeft /></button><p>{group.name}</p><span className="header-spacer" /></header>
    <div className="member-hero">
      <Avatar profile={member} size="lg" />
      <div><h1>{member.nickname}的心愿空间</h1><p>{birthday ? `生日 ${birthday.label}` : '还没有登记生日'}</p></div>
    </div>
    <div className="member-summary"><div><b>{wishes.filter(w => w.ownerId === member.id && w.groupIds.includes(group.id) && w.status === 'active').length}</b><span>正在期待</span></div><div><b>{wishes.filter(w => w.ownerId === member.id && w.status === 'fulfilled').length}</b><span>已经实现</span></div><div><b>{member.id === currentUser.id ? '自己' : '好友'}</b><span>群组关系</span></div></div>
    <div className="section-heading"><div><h2>{filters.category === '全部' ? '全部心愿' : filters.category}</h2></div><div className="heading-actions"><SortControl value={sort} onChange={onSort} /><button className="filter-trigger icon-only-filter" aria-label="筛选心愿" onClick={onFilters}><SlidersHorizontal size={15} /></button></div></div>
    <div className="wish-list">{filtered.map(wish => <WishCard key={wish.id} wish={wish} owner={member} claim={claims.find(c => c.wishId === wish.id && c.groupId === group.id)?.state} isOwner={member.id === currentUser.id} onOpen={() => onOpenWish(wish.id)} />)}</div>
    {!filtered.length && <div className="empty"><Heart /><h3>暂时没有符合条件的心愿</h3></div>}
  </section>
}

function FilterSheet({ value, onChange, onClose }: { value: Filters; onChange: (value: Filters) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(value)
  return <div className="sheet-backdrop" onMouseDown={onClose}><section className="mini-sheet filters-sheet" onMouseDown={e => e.stopPropagation()}><div className="sheet-handle" /><button className="sheet-close" onClick={onClose}><X /></button>
    <div className="filter-title"><div><h2>筛选心愿</h2></div><button className="text-button" onClick={() => setDraft({ category: '全部', kind: 'all', budgetMax: null, priorityMin: 1 })}>重置</button></div>
    <fieldset><legend>心愿类别</legend><div className="choice-grid categories">{categories.map(category => <button type="button" key={category} className={draft.category === category ? 'active' : ''} onClick={() => setDraft({ ...draft, category })}>{category}</button>)}</div></fieldset>
    <fieldset><legend>表达方式</legend><div className="choice-grid"><button type="button" className={draft.kind === 'all' ? 'active' : ''} onClick={() => setDraft({ ...draft, kind: 'all' })}>不限</button><button type="button" className={draft.kind === 'inspiration' ? 'active' : ''} onClick={() => setDraft({ ...draft, kind: 'inspiration' })}>心愿灵感</button><button type="button" className={draft.kind === 'exact' ? 'active' : ''} onClick={() => setDraft({ ...draft, kind: 'exact' })}>具体商品</button></div></fieldset>
    <fieldset><legend>预算上限</legend><div className="choice-grid four">{[{l:'不限',v:null},{l:'¥100',v:100},{l:'¥300',v:300},{l:'¥500',v:500}].map(option => <button type="button" key={option.l} className={draft.budgetMax === option.v ? 'active' : ''} onClick={() => setDraft({ ...draft, budgetMax: option.v })}>{option.l}</button>)}</div></fieldset>
    <fieldset><legend>最低优先级</legend><div className="priority-filter"><Stars value={draft.priorityMin} editable onChange={priorityMin => setDraft({ ...draft, priorityMin })} /><span>{draft.priorityMin === 1 ? '不限' : `${draft.priorityMin}星及以上`}</span></div></fieldset>
    <button className="primary full" onClick={() => { onChange(draft); onClose() }}>查看筛选结果</button>
  </section></div>
}

function CalendarPage({ groups, members, currentUser, onBack, onSelectMember, onEditMine }: {
  groups: Group[]; members: Profile[]; currentUser: Profile; onBack: () => void; onSelectMember: (id: string) => void; onEditMine: (birthday: string) => void
}) {
  const now = new Date()
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [birthday, setBirthday] = useState(currentUser.birthday || '')
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const dayCount = new Date(year, month + 1, 0).getDate()
  const cells: Array<number | null> = [...Array(firstWeekday).fill(null), ...Array.from({ length: dayCount }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  const birthdaysFor = (day: number) => members.filter(member => {
    const parts = birthdayParts(member.birthday)
    return parts?.month === month + 1 && parts.day === day
  })
  const selectedMembers = selectedDay ? birthdaysFor(selectedDay) : []
  const monthEntries = members.filter(member => birthdayParts(member.birthday)?.month === month + 1)
    .sort((a, b) => (birthdayParts(a.birthday)?.day || 0) - (birthdayParts(b.birthday)?.day || 0))
  const goMonth = (delta: number) => { setCursor(new Date(year, month + delta, 1)); setSelectedDay(null) }

  return <section className="page calendar-page">
    <header className="simple-header"><button className="icon-button" onClick={onBack}><ArrowLeft /></button><div><h1>生日日历</h1></div><button className="calendar-today" onClick={() => { setCursor(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDay(now.getDate()) }}>今天</button></header>
    <article className="month-card">
      <div className="month-nav"><button onClick={() => goMonth(-1)}><ChevronLeft /></button><div><h2>{year}年{month + 1}月</h2><p>{monthEntries.length ? `本月有${monthEntries.length}位成员过生日` : '本月暂无生日'}</p></div><button onClick={() => goMonth(1)}><ChevronRight /></button></div>
      <div className="weekdays">{['日','一','二','三','四','五','六'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">{cells.map((day, index) => {
        if (!day) return <span className="calendar-cell empty-cell" key={`blank-${index}`} />
        const members = birthdaysFor(day)
        const isToday = year === now.getFullYear() && month === now.getMonth() && day === now.getDate()
        const selected = selectedDay === day
        return <button key={day} className={`calendar-cell${isToday ? ' today' : ''}${selected ? ' selected' : ''}${members.length ? ' has-birthday' : ''}`} onClick={() => setSelectedDay(day)}>
          <span>{day}</span>
          {members.length > 0 && <div className="calendar-avatars">{members.slice(0, 2).map(member => <i key={member.id} style={{ background: member.color }}>{member.nickname.slice(0,1)}</i>)}{members.length > 2 && <em>+{members.length - 2}</em>}</div>}
        </button>
      })}</div>
    </article>
    <section className="calendar-detail">
      <div className="section-heading"><div><h2>{selectedDay ? `${month + 1}月${selectedDay}日` : `${month + 1}月的生日`}</h2></div>{!editing && <button className="calendar-link" onClick={() => setEditing(true)}><Plus size={15} />登记我的生日</button>}</div>
      {editing && <form className="calendar-birthday-edit" onSubmit={e => { e.preventDefault(); onEditMine(birthday); setEditing(false); const parts = birthdayParts(birthday); if (parts) { setCursor(new Date(year, parts.month - 1, 1)); setSelectedDay(parts.day) } }}><label>选择我的生日<input required type="date" value={birthday} onChange={e => setBirthday(e.target.value)} /></label><button className="primary">保存</button><button type="button" className="text-button" onClick={() => setEditing(false)}>取消</button></form>}
      <div className="calendar-events">{(selectedDay ? selectedMembers : monthEntries).map(member => { const parts = birthdayParts(member.birthday)!; const groupNames = groups.filter(group => group.members.some(item => item.id === member.id)).map(group => group.name).join(' · '); return <button key={member.id} onClick={() => onSelectMember(member.id)}><div className="date-block"><b>{String(parts.day).padStart(2,'0')}</b><span>{month + 1}月</span></div><Avatar profile={member} /><div><b>{member.nickname}{member.id === currentUser.id && <em>我</em>}</b><span>{groupNames || '去看看TA的心愿'}</span></div><ArrowRight /></button> })}</div>
      {(selectedDay ? selectedMembers : monthEntries).length === 0 && !editing && <div className="calendar-empty"><Cake /><p>{selectedDay ? '这一天还没有登记生日' : '这个月还没有成员生日'}</p></div>}
    </section>
  </section>
}

function GroupDetail({ group, wishes, currentUser, onMember, onCopyInvite, onClose }: {
  group: Group; wishes: Wish[]; currentUser: Profile; onMember: (id: string) => void; onCopyInvite: () => void; onClose: () => void
}) {
  return <div className="sheet-backdrop" onMouseDown={onClose}>
    <section className="mini-sheet group-detail-sheet" onMouseDown={event => event.stopPropagation()}>
      <div className="sheet-handle" /><button className="sheet-close" onClick={onClose}><X /></button>
      <div className="group-detail-hero"><span>{group.emoji}</span><div><h2>{group.name}</h2><p>{group.members.length} 位成员</p></div></div>
      <div className="invite-card">
        <div><small>群组邀请码</small><b>{group.inviteCode}</b></div>
        <button className="primary" onClick={onCopyInvite}><Link2 size={15} />复制邀请码</button>
      </div>
      <div className="group-detail-heading"><div><h3>群组成员</h3></div><span>{group.members.length} 人</span></div>
      <div className="group-member-list">{group.members.map(member => {
        const birthday = nextBirthday(member.birthday)
        const activeCount = wishes.filter(wish => wish.ownerId === member.id && wish.groupIds.includes(group.id) && wish.status === 'active').length
        return <button key={member.id} onClick={() => onMember(member.id)}>
          <Avatar profile={member} />
          <div><b>{member.nickname}{member.id === currentUser.id && <em>我</em>}</b><span>{birthday ? `${birthday.label}　${birthday.days === 0 ? '今天生日' : `${birthday.days}天后`}` : '生日待登记'}</span></div>
          <small>{activeCount} 个心愿</small><ArrowRight size={17} />
        </button>
      })}</div>
    </section>
  </div>
}

function NotificationsPage({ onBack }: { onBack: () => void }) {
  return <section className="page notifications-page">
    <header className="simple-header"><button className="icon-button" onClick={onBack}><ArrowLeft /></button><h1>消息通知</h1><span className="header-spacer" /></header>
    <div className="notification-list">
      <article><span className="notification-icon"><Users size={18} /></span><div><h2>已加入“周末放空小组”</h2><p>现在可以查看群组成员分享的心愿。</p><time>10月12日</time></div></article>
      <article><span className="notification-icon birthday"><Cake size={18} /></span><div><h2>小猫登记了生日</h2><p>生日是10月26日，已经同步到生日日历。</p><time>10月10日</time></div></article>
    </div>
  </section>
}

function MyProfile({ user, wishCount, unreadCount, demoMode, onBack, onBirthday, onNotifications, onReset, onSignOut }: {
  user: Profile; wishCount: number; unreadCount: number; demoMode: boolean; onBack: () => void; onBirthday: () => void; onNotifications: () => void; onReset: () => void; onSignOut: () => void
}) {
  const birthday = birthdayParts(user.birthday)
  return <section className="page account-page">
    <header className="simple-header"><button className="icon-button" onClick={onBack}><ArrowLeft /></button><h1>我的</h1><span className="header-spacer" /></header>
    <div className="account-hero"><Avatar profile={user} size="lg" /><div><h2>{user.nickname}</h2><p>{wishCount} 个心愿</p></div></div>
    <div className="account-section">
      <button className="account-row" onClick={onNotifications}><span className="account-row-icon notification"><Bell size={19} /></span><div><b>消息通知</b><small>{unreadCount ? `${unreadCount} 条未读消息` : '暂无未读消息'}</small></div>{unreadCount > 0 && <i className="notification-count">{unreadCount}</i>}<ArrowRight size={17} /></button>
      <button className="account-row" onClick={onBirthday}><span className="account-row-icon"><Cake size={19} /></span><div><b>我的生日</b><small>{birthday ? `${birthday.month}月${birthday.day}日` : '未登记'}</small></div><ArrowRight size={17} /></button>
      <div className="account-row account-placeholder"><span className="account-row-icon"><UserRound size={19} /></span><div><b>个人设置</b><small>头像、昵称、通知与隐私</small></div></div>
    </div>
    {demoMode ? <button className="demo-reset" onClick={onReset}>重置体验数据</button> : <button className="demo-reset" onClick={onSignOut}><LogOut size={15} />退出登录</button>}
  </section>
}

function AddWish({ groups, initial, onSave, onCancel }: { groups: Group[]; initial?: Wish; onSave: (wish: Omit<Wish, 'id' | 'ownerId' | 'createdAt' | 'status'>) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<WishKind>(initial?.kind || 'inspiration')
  const [title, setTitle] = useState(initial?.title || '')
  const [priority, setPriority] = useState(initial?.priority || 3)
  const [category, setCategory] = useState(initial?.category || '生活好物')
  const [budgetMin, setBudgetMin] = useState(initial?.budgetMin?.toString() || '')
  const [budgetMax, setBudgetMax] = useState(initial?.budgetMax?.toString() || '')
  const [price, setPrice] = useState(initial?.price?.toString() || '')
  const [platform, setPlatform] = useState(initial?.platform || '')
  const [url, setUrl] = useState(initial?.url || '')
  const [note, setNote] = useState(initial?.note || '')
  const [styleNote, setStyleNote] = useState(initial?.styleNote || '')
  const [image, setImage] = useState(initial?.image || '')
  const [imageError, setImageError] = useState('')
  const [selected, setSelected] = useState<string[]>(initial?.groupIds || [])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave({ title, kind, priority, category, note, styleNote, groupIds: selected,
      budgetMin: budgetMin ? Number(budgetMin) : undefined, budgetMax: budgetMax ? Number(budgetMax) : undefined,
      price: price ? Number(price) : undefined, platform, url, image: image || undefined, overrides: initial?.overrides })
  }
  return <section className="page add-page">
    <header className="simple-header"><button className="icon-button" onClick={onCancel}><X /></button><h1>{initial ? '编辑心愿' : '添加心愿'}</h1><button className="text-button" form="wish-form">保存</button></header>
    <form id="wish-form" onSubmit={submit} className="form-stack">
      <div className="segmented kind-segment">
        <button type="button" className={kind === 'inspiration' ? 'active' : ''} onClick={() => setKind('inspiration')}><Sparkles size={17} />心愿灵感</button>
        <button type="button" className={kind === 'exact' ? 'active' : ''} onClick={() => setKind('exact')}><Gift size={17} />具体商品</button>
      </div>
      <label>心愿名称<span>*</span><input required value={title} onChange={e => setTitle(e.target.value)} /></label>
      <div className="two-cols"><label>心愿类别<select value={category} onChange={e => setCategory(e.target.value)}><option>生活好物</option><option>家居</option><option>穿搭</option><option>数码</option><option>书影音</option><option>体验</option><option>其他</option></select></label><label>有多想要<Stars value={priority} editable onChange={setPriority} /></label></div>
      {kind === 'inspiration' ? <>
        <div className="two-cols"><label>最低预算<input inputMode="numeric" value={budgetMin} onChange={e => setBudgetMin(e.target.value)} /></label><label>最高预算<input inputMode="numeric" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} /></label></div>
        <label>喜欢什么样的<textarea value={styleNote} onChange={e => setStyleNote(e.target.value)} placeholder="喜欢或不喜欢的颜色、风格、尺寸等" /></label>
      </> : <>
        <div className="two-cols"><label>参考价格<input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} /></label><label>购买平台<input value={platform} onChange={e => setPlatform(e.target.value)} /></label></div>
        <label>商品链接<input type="url" value={url} onChange={e => setUrl(e.target.value)} /></label>
      </>}
      <div className="wish-image-field">
        <div className={`wish-image-preview${image ? '' : ' empty'}`} style={{ backgroundImage: image ? `url(${image})` : undefined }}>{!image && <Gift aria-hidden="true" />}</div>
        <div className="wish-image-actions">
          <span>心愿图片</span>
          <label className="image-upload-button"><ImagePlus size={17} />{image ? '更换图片' : '上传图片'}<input type="file" accept="image/*" onChange={async event => {
            const file = event.target.files?.[0]
            if (!file) return
            try { setImageError(''); setImage(await readWishImage(file)) }
            catch (error) { setImageError(error instanceof Error ? error.message : '图片读取失败') }
            event.target.value = ''
          }} /></label>
          {image && <button type="button" className="remove-image-button" onClick={() => setImage('')}>移除图片</button>}
          {imageError && <small className="form-error">{imageError}</small>}
        </div>
      </div>
      <label>补充说明<textarea value={note} onChange={e => setNote(e.target.value)} /></label>
      <fieldset><legend>分享给谁</legend>
        <div className="group-options"><button type="button" className={!selected.length ? 'group-option checked' : 'group-option'} onClick={() => setSelected([])}><span><LockKeyhole size={18} /></span><div><b>仅自己可见</b></div><i>{!selected.length && <Check size={15} />}</i></button>{groups.map(group => { const checked = selected.includes(group.id); return <button type="button" key={group.id} className={checked ? 'group-option checked' : 'group-option'} onClick={() => setSelected(s => checked ? s.filter(id => id !== group.id) : [...s, group.id])}><span>{group.emoji}</span><div><b>{group.name}</b><small>{group.members.length}位成员</small></div><i>{checked && <Check size={15} />}</i></button> })}</div>
      </fieldset>
      <button className="primary full save-button" disabled={!title.trim()}>{initial ? <Pencil size={18} /> : <Sparkles size={18} />}{initial ? '保存修改' : '保存心愿'}</button>
    </form>
  </section>
}

function App() {
  const [mode, setMode] = useState<'loading' | 'auth' | 'setup' | 'app'>(hasSupabase ? 'loading' : 'app')
  const [demoMode, setDemoMode] = useState(!hasSupabase)
  const [data, setData] = useState<AppData>(getStoredData)
  const [currentUserId, setCurrentUserId] = useState(localStorage.getItem(USER_KEY) || 'u1')
  const [tab, setTab] = useState<Tab>('me')
  const [selectedGroupId, setSelectedGroupId] = useState('g1')
  const [status, setStatus] = useState<'active' | 'fulfilled'>('active')
  const [selectedWishId, setSelectedWishId] = useState<string | null>(null)
  const [editingWishId, setEditingWishId] = useState<string | null>(null)
  const [composeReturnTab, setComposeReturnTab] = useState<'me' | 'groups'>('me')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(2)
  const [modal, setModal] = useState<Modal>(null)
  const [toast, setToast] = useState('')
  const [filters, setFilters] = useState<Filters>({ category: '全部', kind: 'all', budgetMax: null, priorityMin: 1 })
  const [sort, setSort] = useState<SortMode>('newest')

  const refresh = async () => {
    const state = await backend.loadAppState()
    if (state.needsProfile) { setMode('setup'); return }
    setCurrentUserId(state.currentUserId); setData(state); setMode('app')
    if (state.groups[0]) setSelectedGroupId(state.groups[0].id)
  }

  useEffect(() => {
    if (!hasSupabase || demoMode) return
    supabase!.auth.getSession().then(({ data: auth }) => auth.session ? refresh().catch(() => setMode('setup')) : setMode('auth'))
    const { data: listener } = supabase!.auth.onAuthStateChange((_event, session) => session ? refresh().catch(() => setMode('setup')) : setMode('auth'))
    return () => listener.subscription.unsubscribe()
  }, [demoMode])

  useEffect(() => { if (demoMode) localStorage.setItem(STORE_KEY, JSON.stringify(data)) }, [data, demoMode])
  useEffect(() => { if (demoMode) localStorage.setItem(USER_KEY, currentUserId) }, [currentUserId, demoMode])
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(''), 2200); return () => clearTimeout(id) }, [toast])

  const user = data.profiles.find(p => p.id === currentUserId) || data.profiles[0]
  const myGroups = data.groups.filter(g => g.members.some(m => m.id === user.id))
  const group = myGroups.find(g => g.id === selectedGroupId) || myGroups[0]
  const selectedMember = group?.members.find(m => m.id === selectedMemberId)
  const globalMembers = useMemo(() => Array.from(new Map(myGroups.flatMap(item => item.members).map(member => [member.id, member])).values()), [myGroups])
  const upcomingBirthday = group ? sortedBirthdays(group.members.filter(member => member.id !== user.id))[0] : undefined
  const selectedWish = data.wishes.find(w => w.id === selectedWishId)
  const editingWish = data.wishes.find(w => w.id === editingWishId)
  const selectedOwner = selectedWish ? data.profiles.find(p => p.id === selectedWish.ownerId) : undefined
  const visibleWishes = useMemo(() => sortWishes(data.wishes.filter(w => group && w.groupIds.includes(group.id) && w.status === status && wishMatches(w, filters)), sort), [data.wishes, group, status, filters, sort])
  const myVisibleWishes = useMemo(() => sortWishes(data.wishes.filter(w => w.ownerId === user.id && w.status === status && wishMatches(w, filters)), sort), [data.wishes, user.id, status, filters, sort])

  if (mode === 'loading') return <main className="auth-shell"><div className="logo-orb pulse"><Heart /></div></main>
  if (mode === 'auth') return <AuthScreen onDemo={() => { setDemoMode(true); setMode('app') }} />
  if (mode === 'setup') return <ProfileSetup onDone={refresh} />

  const mutate = async (remote: () => Promise<void>, local: () => void, success: string) => {
    if (demoMode) local(); else { await remote(); await refresh() }
    setToast(success)
  }
  const saveWish = async (draft: Omit<Wish, 'id' | 'ownerId' | 'createdAt' | 'status'>) => {
    if (editingWish) {
      await mutate(() => backend.updateWish(editingWish.id, draft), () => setData(d => ({ ...d, wishes: d.wishes.map(w => w.id === editingWish.id ? { ...w, ...draft } : w) })), '心愿已经更新')
    } else {
      await mutate(() => backend.createWish(draft), () => setData(d => ({ ...d, wishes: [{ ...draft, id: crypto.randomUUID(), ownerId: user.id, status: 'active', createdAt: new Date().toISOString() }, ...d.wishes] })), '心愿已经放进空间啦')
    }
    setEditingWishId(null)
    setTab(composeReturnTab)
  }
  const updateClaim = async (state: ClaimState | null) => {
    if (!selectedWish || !group) return
    await mutate(() => backend.setClaim(selectedWish.id, group.id, state), () => setData(d => ({ ...d, claims: state ? [...d.claims.filter(c => !(c.wishId === selectedWish.id && c.groupId === group.id)), { wishId: selectedWish.id, groupId: group.id, claimedBy: user.id, state }] : d.claims.filter(c => !(c.wishId === selectedWish.id && c.groupId === group.id)) })), state ? '只有送礼的朋友能看到这个状态' : '已经取消认领')
  }
  const toggleFulfill = async () => {
    if (!selectedWish) return
    const next = selectedWish.status === 'active' ? 'fulfilled' : 'active'
    await mutate(() => backend.setWishStatus(selectedWish.id, next), () => setData(d => ({ ...d, wishes: d.wishes.map(w => w.id === selectedWish.id ? { ...w, status: next } : w) })), next === 'fulfilled' ? '愿望实现，撒花！' : '心愿已经重新开启')
  }
  const deleteWish = async () => {
    if (!selectedWish || selectedWish.ownerId !== user.id) return
    if (!window.confirm('确定删除这条心愿吗？删除后无法恢复。')) return
    const wishId = selectedWish.id
    await mutate(() => backend.deleteWish(wishId), () => setData(d => ({
      ...d,
      wishes: d.wishes.filter(w => w.id !== wishId),
      claims: d.claims.filter(claim => claim.wishId !== wishId),
    })), '心愿已删除')
    setSelectedWishId(null)
  }
  const updateBirthday = async (birthday: string) => {
    await mutate(() => backend.setBirthday(birthday), () => setData(d => ({
      ...d,
      profiles: d.profiles.map(p => p.id === user.id ? { ...p, birthday } : p),
      groups: d.groups.map(g => ({ ...g, members: g.members.map(m => m.id === user.id ? { ...m, birthday } : m) })),
    })), '生日已经登记好啦')
  }
  const openGlobalMember = (memberId: string) => {
    const memberGroup = myGroups.find(item => item.members.some(member => member.id === memberId))
    if (memberGroup) setSelectedGroupId(memberGroup.id)
    setSelectedMemberId(memberId)
    setCalendarOpen(false)
    setModal(null)
  }
  const copyInvite = async () => {
    if (!group) return
    try { await navigator.clipboard.writeText(group.inviteCode); setToast('邀请码已复制，可以发给朋友啦') }
    catch { setToast(`邀请码：${group.inviteCode}`) }
  }
  const openComposer = (returnTab: 'me' | 'groups', wishId?: string) => {
    setComposeReturnTab(returnTab)
    setEditingWishId(wishId || null)
    setSelectedWishId(null)
    setTab('add')
  }

  return <div className="desktop-stage">
    <div className="phone-shell">
      {tab === 'groups' && group && calendarOpen && <CalendarPage groups={myGroups} members={globalMembers} currentUser={user} onBack={() => setCalendarOpen(false)} onSelectMember={openGlobalMember} onEditMine={updateBirthday} />}

      {tab === 'groups' && group && !calendarOpen && selectedMember && <MemberView member={selectedMember} group={group} wishes={data.wishes} claims={data.claims} currentUser={user} filters={filters} sort={sort} onSort={setSort} onFilters={() => setModal('filters')} onBack={() => setSelectedMemberId(null)} onOpenWish={setSelectedWishId} />}

      {tab === 'groups' && group && !calendarOpen && !selectedMember && <section className="page groups-page">
        <header className="top-header">
          <div className="group-header-actions"><button className="group-switch" onClick={() => setModal('group-menu')}><span>{group.emoji}</span><b>{group.name}</b><ChevronDown size={16} /></button></div>
          <button className="icon-button calendar-header-button" onClick={() => setCalendarOpen(true)} aria-label="打开生日日历"><CalendarDays /></button>
        </header>
        <button className="birthday-card" onClick={() => upcomingBirthday ? openGlobalMember(upcomingBirthday.member.id) : setCalendarOpen(true)}>
          <div className="compact-birthday-icon">{upcomingBirthday ? <Avatar profile={upcomingBirthday.member} /> : <Cake />}</div>
          <div><p className="eyebrow birthday-eyebrow"><Cake size={12} />下一个生日</p><h2>{upcomingBirthday ? `${upcomingBirthday.member.nickname}　${upcomingBirthday.next.label}` : '还没有好友登记生日'}</h2><p>{upcomingBirthday ? (upcomingBirthday.next.days === 0 ? '就是今天，去看看TA的心愿' : `还有${upcomingBirthday.next.days}天　去看看TA的心愿`) : '可以提醒群组成员登记生日'}</p></div>
          <ArrowRight size={19} />
        </button>
        <div className="view-toolbar slim-toolbar">
          <div className="segmented compact"><button className={status === 'active' ? 'active' : ''} onClick={() => setStatus('active')}>正在期待</button><button className={status === 'fulfilled' ? 'active' : ''} onClick={() => setStatus('fulfilled')}>已经实现</button></div>
          <div className="toolbar-actions"><SortControl value={sort} onChange={setSort} /><button className="filter-trigger toolbar-filter icon-only-filter" aria-label="筛选心愿" onClick={() => setModal('filters')}><SlidersHorizontal size={16} /></button></div>
        </div>
        <div className="section-heading wishes-heading"><div><h2>{status === 'active' ? '正在期待的心愿' : '已经实现的心愿'}</h2></div><span>{filters.category === '全部' ? `${visibleWishes.length} 项` : `${filters.category}　${visibleWishes.length} 项`}</span></div>
        <div className="wish-list">{visibleWishes.map(wish => { const owner = data.profiles.find(p => p.id === wish.ownerId)!; const claim = data.claims.find(c => c.wishId === wish.id && c.groupId === group.id)?.state; return <WishCard key={wish.id} wish={wish} owner={owner} claim={claim} isOwner={owner.id === user.id} onOpen={() => setSelectedWishId(wish.id)} onOwnerOpen={owner.id === user.id ? undefined : () => setSelectedMemberId(owner.id)} /> })}</div>
        {!visibleWishes.length && <div className="empty"><Sparkles /><h3>这里还没有心愿</h3></div>}
      </section>}

      {tab === 'add' && <AddWish key={editingWishId || 'new'} groups={myGroups} initial={editingWish} onSave={saveWish} onCancel={() => { setEditingWishId(null); setTab(composeReturnTab) }} />}

      {tab === 'me' && notificationsOpen && <NotificationsPage onBack={() => { setNotificationsOpen(false); setProfileOpen(true) }} />}

      {tab === 'me' && profileOpen && !notificationsOpen && <MyProfile user={user} wishCount={data.wishes.filter(w => w.ownerId === user.id).length} unreadCount={unreadCount} demoMode={demoMode} onBack={() => setProfileOpen(false)} onBirthday={() => { setProfileOpen(false); setTab('groups'); setCalendarOpen(true) }} onNotifications={() => { setUnreadCount(0); setProfileOpen(false); setNotificationsOpen(true) }} onReset={() => { setData(cloneDemo()); setCurrentUserId('u1'); setUnreadCount(2); setToast('体验数据已重置') }} onSignOut={() => supabase?.auth.signOut()} />}

      {tab === 'me' && !profileOpen && !notificationsOpen && <section className="page me-page">
        <header className="profile-header"><button className="profile-entry profile-avatar-button" onClick={() => setProfileOpen(true)} aria-label={`打开${user.nickname}的资料`}><span className="profile-avatar-wrap"><Avatar profile={user} />{unreadCount > 0 && <i className="unread-dot" />}</span><span>{user.nickname}</span></button></header>
        {demoMode && <label className="demo-identity"><span>体验身份</span><select value={user.id} onChange={e => { setCurrentUserId(e.target.value); setSelectedWishId(null) }}>{data.profiles.map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}</select></label>}
        <div className="view-toolbar slim-toolbar my-wish-toolbar">
          <div className="segmented compact"><button className={status === 'active' ? 'active' : ''} onClick={() => setStatus('active')}>正在期待</button><button className={status === 'fulfilled' ? 'active' : ''} onClick={() => setStatus('fulfilled')}>已经实现</button></div>
          <div className="toolbar-actions"><SortControl value={sort} onChange={setSort} /><button className="filter-trigger toolbar-filter icon-only-filter" aria-label="筛选心愿" onClick={() => setModal('filters')}><SlidersHorizontal size={16} /></button></div>
        </div>
        <div className="section-heading wishes-heading"><div><h2>{status === 'active' ? '正在期待的心愿' : '已经实现的心愿'}</h2></div><span>{filters.category === '全部' ? `${myVisibleWishes.length} 项` : `${filters.category}　${myVisibleWishes.length} 项`}</span></div>
        <div className="wish-list">{myVisibleWishes.map(w => <WishCard key={w.id} wish={w} owner={user} isOwner onOpen={() => { const firstGroup = myGroups.find(g => w.groupIds.includes(g.id)); if (firstGroup) setSelectedGroupId(firstGroup.id); setSelectedWishId(w.id) }} />)}</div>
        {!myVisibleWishes.length && <div className="empty"><Heart /><h3>暂时没有符合条件的心愿</h3></div>}
      </section>}

      {tab !== 'add' && !selectedMember && !calendarOpen && !profileOpen && !notificationsOpen && <nav className="bottom-nav">
        <button className={tab === 'me' ? 'active' : ''} onClick={() => setTab('me')}><Home /><span>我的心愿</span></button>
        <button className="add-fab" onClick={() => openComposer(tab === 'groups' ? 'groups' : 'me')}><Plus /></button>
        <button className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}><Users /><span>群组心愿</span></button>
      </nav>}

      {selectedWish && selectedOwner && group && <WishDetail wish={selectedWish} owner={selectedOwner} group={group} sharedGroups={myGroups.filter(item => selectedWish.groupIds.includes(item.id))} user={user} claim={data.claims.find(c => c.wishId === selectedWish.id && c.groupId === group.id)?.state} onClose={() => setSelectedWishId(null)} onClaim={updateClaim} onFulfill={toggleFulfill} onDelete={deleteWish} onEdit={() => openComposer(tab === 'groups' ? 'groups' : 'me', selectedWish.id)} onOwnerOpen={() => { setSelectedWishId(null); setTab('groups'); setSelectedMemberId(selectedOwner.id) }} />}

      {modal === 'group-menu' && <div className="sheet-backdrop" onMouseDown={() => setModal(null)}><section className="mini-sheet group-switch-sheet" onMouseDown={e => e.stopPropagation()}><div className="sheet-handle" /><h2>切换群组</h2><div className="group-menu">{myGroups.map(g => <div key={g.id} className={`group-menu-row${g.id === group?.id ? ' active' : ''}`}><button className="group-select-button" onClick={() => { setSelectedGroupId(g.id); setModal(null) }}><span>{g.emoji}</span><div><b>{g.name}</b><small>{g.members.length}位成员</small></div>{g.id === group?.id && <Check />}</button><button className="group-row-detail" onClick={() => { setSelectedGroupId(g.id); setModal('group-detail') }} aria-label={`查看${g.name}详情`}><MoreHorizontal /></button></div>)}</div><div className="two-actions"><button className="secondary" onClick={() => setModal('group-create')}><Plus />创建群组</button><button className="secondary" onClick={() => setModal('group-join')}><Link2 />加入群组</button></div></section></div>}
      {modal === 'group-detail' && group && <GroupDetail group={group} wishes={data.wishes} currentUser={user} onMember={id => { setSelectedMemberId(id); setModal(null) }} onCopyInvite={copyInvite} onClose={() => setModal(null)} />}
      {modal === 'filters' && <FilterSheet value={filters} onChange={setFilters} onClose={() => setModal(null)} />}
      {(modal === 'group-create' || modal === 'group-join') && <GroupModal type={modal === 'group-create' ? 'create' : 'join'} onClose={() => setModal(null)} onSubmit={async value => {
        if (modal === 'group-create') await mutate(() => backend.createGroup(value, '✨'), () => { const g: Group = { id: crypto.randomUUID(), name: value, emoji: '✨', inviteCode: `WISH-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, members: [user] }; setData(d => ({ ...d, groups: [...d.groups, g] })); setSelectedGroupId(g.id) }, '群组创建成功')
        else await mutate(() => backend.joinGroup(value), () => {}, '已经加入群组')
        setModal(null)
      }} />}
      {toast && <div className="toast"><Check size={16} />{toast}</div>}
      {demoMode && <div className="demo-pill"><span />演示模式</div>}
    </div>
  </div>
}

function GroupModal({ type, onClose, onSubmit }: { type: 'create' | 'join'; onClose: () => void; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState('')
  return <div className="sheet-backdrop"><form className="mini-sheet form-stack group-form-sheet" aria-label={type === 'create' ? '创建群组' : '加入群组'} onSubmit={e => { e.preventDefault(); onSubmit(value) }}><div className="sheet-handle" /><button type="button" className="sheet-close" onClick={onClose}><X /></button><label>{type === 'create' ? '群组名称' : '邀请码'}<input autoFocus required value={value} onChange={e => setValue(e.target.value)} /></label><button className="primary full">{type === 'create' ? '创建群组' : '加入群组'}</button></form></div>
}

export default App
