import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Check, ChevronDown, Copy, Gift, Heart, Home, Link2, LockKeyhole,
  LogOut, MoreHorizontal, PackageCheck, Plus, Search, Sparkles, Star, Users, X,
} from 'lucide-react'
import { demoData } from './data/demo'
import { hasSupabase, supabase } from './lib/supabase'
import * as backend from './lib/backend'
import type { AppData, ClaimState, Group, Profile, Wish, WishKind } from './types'

type Tab = 'groups' | 'add' | 'me'
type Modal = 'group-menu' | 'group-create' | 'group-join' | null

const STORE_KEY = 'wish-space-demo-v1'
const USER_KEY = 'wish-space-demo-user'

function cloneDemo(): AppData {
  return JSON.parse(JSON.stringify(demoData)) as AppData
}

function getStoredData() {
  try {
    const value = localStorage.getItem(STORE_KEY)
    return value ? JSON.parse(value) as AppData : cloneDemo()
  } catch { return cloneDemo() }
}

function Avatar({ profile, size = 'md' }: { profile: Profile; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`avatar avatar-${size}`} style={{ background: profile.color }} title={profile.nickname}>
      {profile.nickname.slice(0, 1)}
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
      <p className="eyebrow">WISH SPACE</p>
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
    <p className="eyebrow">欢迎来到心愿空间</p><h1>朋友怎么称呼你？</h1>
    <p className="auth-lead">昵称会显示在你加入的群组和发布的心愿旁。</p>
    <label>专属昵称<input required maxLength={16} value={nickname} onChange={e => setNickname(e.target.value)} placeholder="例如：小鹿" /></label>
    <button className="primary full" disabled={!nickname.trim() || loading}>进入心愿空间</button>
  </form></main>
}

function WishCard({ wish, owner, claim, isOwner, onOpen }: { wish: Wish; owner: Profile; claim?: ClaimState; isOwner: boolean; onOpen: () => void }) {
  const price = wish.kind === 'exact' && wish.price ? `¥${wish.price}` : wish.budgetMin || wish.budgetMax
    ? `¥${wish.budgetMin ?? 0}–${wish.budgetMax ?? '不限'}` : '预算不限'
  return <button className="wish-card" onClick={onOpen}>
    <div className="wish-image" style={{ backgroundImage: wish.image ? `url(${wish.image})` : undefined }}>
      <span className={`kind-badge ${wish.kind}`}>{wish.kind === 'exact' ? '具体商品' : '心愿灵感'}</span>
      {!isOwner && claim && <span className="claim-badge"><LockKeyhole size={12} />{claim === 'purchased' ? '已买好' : '已认领'}</span>}
    </div>
    <div className="wish-content">
      <div className="wish-owner"><Avatar profile={owner} size="sm" /><span>{owner.nickname}</span><span className="dot">·</span><span>{wish.category}</span></div>
      <h3>{wish.title}</h3>
      <p>{wish.note || wish.styleNote || '看看这份心愿的更多细节'}</p>
      <div className="wish-meta"><span className="price">{price}</span><Stars value={wish.priority} /></div>
    </div>
  </button>
}

function WishDetail({ wish, owner, group, user, claim, onClose, onClaim, onFulfill }: {
  wish: Wish; owner: Profile; group: Group; user: Profile; claim?: ClaimState;
  onClose: () => void; onClaim: (state: ClaimState | null) => void; onFulfill: () => void
}) {
  const isOwner = wish.ownerId === user.id
  const override = wish.overrides?.find(o => o.groupId === group.id)
  const note = override?.note || wish.note
  return <div className="sheet-backdrop" onMouseDown={onClose}><article className="detail-sheet" onMouseDown={e => e.stopPropagation()}>
    <div className="sheet-handle" /><button className="sheet-close" onClick={onClose}><X /></button>
    {wish.image && <div className="detail-image" style={{ backgroundImage: `url(${wish.image})` }} />}
    <div className="detail-body">
      <div className="wish-owner"><Avatar profile={owner} /><div><b>{owner.nickname}的心愿</b><small>分享在「{group.name}」</small></div></div>
      <div className="detail-title-row"><div><span className={`kind-badge ${wish.kind}`}>{wish.kind === 'exact' ? '具体商品' : '心愿灵感'}</span><h2>{wish.title}</h2></div><Stars value={wish.priority} /></div>
      <div className="detail-grid">
        <div><small>{wish.kind === 'exact' ? '参考价格' : '预算范围'}</small><b>{wish.kind === 'exact' ? (override?.price || wish.price ? `¥${override?.price ?? wish.price}` : '未填写') : `¥${wish.budgetMin ?? 0}–${wish.budgetMax ?? '不限'}`}</b></div>
        <div><small>类别</small><b>{wish.category}</b></div>
      </div>
      {wish.styleNote && <section className="detail-note"><small>喜欢什么样的</small><p>{wish.styleNote}</p></section>}
      {note && <section className="detail-note"><small>补充说明</small><p>{note}</p></section>}
      {(override?.url || wish.url) && <a className="product-link" href={override?.url || wish.url} target="_blank" rel="noreferrer"><Link2 size={18} /><span>{override?.platform || wish.platform || '查看商品参考'}</span></a>}
      {isOwner ? <div className="owner-state">
        <Heart size={20} /><div><b>{wish.status === 'fulfilled' ? '这个心愿已经实现啦' : '朋友看到的是同一份心愿'}</b><p>认领状态对你隐藏，惊喜会一直保留。</p></div>
        <button className="text-button" onClick={onFulfill}>{wish.status === 'fulfilled' ? '重新开启' : '标记实现'}</button>
      </div> : <section className="claim-panel">
        <div><p className="eyebrow">秘密协作区</p><h3>{claim ? (claim === 'purchased' ? '这份礼物已经准备好' : '有人准备送这份礼物') : '想把这份心愿变成惊喜吗？'}</h3><p>认领状态只对送礼的朋友可见，{owner.nickname}不会看到。</p></div>
        {!claim ? <button className="primary full" onClick={() => onClaim('reserved')}><Gift size={18} />秘密认领</button> :
          <div className="claim-actions">
            <button className={claim === 'purchased' ? 'primary' : 'secondary'} onClick={() => onClaim('purchased')}><PackageCheck size={18} />我已经买好</button>
            <button className="ghost-danger" onClick={() => onClaim(null)}>取消认领</button>
          </div>}
      </section>}
    </div>
  </article></div>
}

function AddWish({ groups, onSave, onCancel }: { groups: Group[]; onSave: (wish: Omit<Wish, 'id' | 'ownerId' | 'createdAt' | 'status'>) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<WishKind>('inspiration')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState(3)
  const [category, setCategory] = useState('生活好物')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [price, setPrice] = useState('')
  const [platform, setPlatform] = useState('')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [styleNote, setStyleNote] = useState('')
  const [selected, setSelected] = useState<string[]>(groups[0] ? [groups[0].id] : [])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave({ title, kind, priority, category, note, styleNote, groupIds: selected,
      budgetMin: budgetMin ? Number(budgetMin) : undefined, budgetMax: budgetMax ? Number(budgetMax) : undefined,
      price: price ? Number(price) : undefined, platform, url })
  }
  return <section className="page add-page">
    <header className="simple-header"><button className="icon-button" onClick={onCancel}><X /></button><h1>添加心愿</h1><button className="text-button" form="wish-form">保存</button></header>
    <form id="wish-form" onSubmit={submit} className="form-stack">
      <div className="segmented kind-segment">
        <button type="button" className={kind === 'inspiration' ? 'active' : ''} onClick={() => setKind('inspiration')}><Sparkles size={17} />心愿灵感</button>
        <button type="button" className={kind === 'exact' ? 'active' : ''} onClick={() => setKind('exact')}><Gift size={17} />具体商品</button>
      </div>
      <p className="kind-help">{kind === 'inspiration' ? '不必知道具体买什么，先告诉朋友你喜欢的大致方向。' : '已经有明确目标？把商品和购买参考放在这里。'}</p>
      <label>心愿名称<span>*</span><input required value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === 'inspiration' ? '例如：一盏适合睡前阅读的台灯' : '例如：HAY Colour Crate 收纳筐'} /></label>
      <div className="two-cols"><label>心愿类别<select value={category} onChange={e => setCategory(e.target.value)}><option>生活好物</option><option>家居</option><option>穿搭</option><option>数码</option><option>书影音</option><option>体验</option><option>其他</option></select></label><label>有多想要<Stars value={priority} editable onChange={setPriority} /></label></div>
      {kind === 'inspiration' ? <>
        <div className="two-cols"><label>最低预算<input inputMode="numeric" value={budgetMin} onChange={e => setBudgetMin(e.target.value)} placeholder="¥ 100" /></label><label>最高预算<input inputMode="numeric" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} placeholder="¥ 300" /></label></div>
        <label>喜欢什么样的<textarea value={styleNote} onChange={e => setStyleNote(e.target.value)} placeholder="颜色、风格、尺寸，或者不喜欢什么……" /></label>
      </> : <>
        <div className="two-cols"><label>参考价格<input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="¥ 199" /></label><label>购买平台<input value={platform} onChange={e => setPlatform(e.target.value)} placeholder="淘宝 / 品牌官网" /></label></div>
        <label>商品链接<input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://" /></label>
      </>}
      <label>补充说明<textarea value={note} onChange={e => setNote(e.target.value)} placeholder="不一定要同款，或者写下颜色、尺码等信息" /></label>
      <fieldset><legend>分享给谁</legend><p className="fieldset-help">只有你选择的群组能够看到这条心愿。</p>
        <div className="group-options">{groups.map(group => { const checked = selected.includes(group.id); return <button type="button" key={group.id} className={checked ? 'group-option checked' : 'group-option'} onClick={() => setSelected(s => checked ? s.filter(id => id !== group.id) : [...s, group.id])}><span>{group.emoji}</span><div><b>{group.name}</b><small>{group.members.length}位成员</small></div><i>{checked && <Check size={15} />}</i></button> })}</div>
      </fieldset>
      <button className="primary full save-button" disabled={!title.trim() || !selected.length}><Sparkles size={18} />保存心愿</button>
    </form>
  </section>
}

function App() {
  const [mode, setMode] = useState<'loading' | 'auth' | 'setup' | 'app'>(hasSupabase ? 'loading' : 'app')
  const [demoMode, setDemoMode] = useState(!hasSupabase)
  const [data, setData] = useState<AppData>(getStoredData)
  const [currentUserId, setCurrentUserId] = useState(localStorage.getItem(USER_KEY) || 'u1')
  const [tab, setTab] = useState<Tab>('groups')
  const [selectedGroupId, setSelectedGroupId] = useState('g1')
  const [status, setStatus] = useState<'active' | 'fulfilled'>('active')
  const [selectedWishId, setSelectedWishId] = useState<string | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')

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
  const selectedWish = data.wishes.find(w => w.id === selectedWishId)
  const selectedOwner = selectedWish ? data.profiles.find(p => p.id === selectedWish.ownerId) : undefined
  const visibleWishes = useMemo(() => data.wishes.filter(w => group && w.groupIds.includes(group.id) && w.status === status && (w.title + w.note + w.category).toLowerCase().includes(query.toLowerCase())), [data.wishes, group, status, query])

  if (mode === 'loading') return <main className="auth-shell"><div className="logo-orb pulse"><Heart /></div></main>
  if (mode === 'auth') return <AuthScreen onDemo={() => { setDemoMode(true); setMode('app') }} />
  if (mode === 'setup') return <ProfileSetup onDone={refresh} />

  const mutate = async (remote: () => Promise<void>, local: () => void, success: string) => {
    if (demoMode) local(); else { await remote(); await refresh() }
    setToast(success)
  }
  const saveWish = async (draft: Omit<Wish, 'id' | 'ownerId' | 'createdAt' | 'status'>) => {
    await mutate(() => backend.createWish(draft), () => setData(d => ({ ...d, wishes: [{ ...draft, id: crypto.randomUUID(), ownerId: user.id, status: 'active', createdAt: new Date().toISOString() }, ...d.wishes] })), '心愿已经放进空间啦')
    setTab('me')
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

  return <div className="desktop-stage">
    <div className="phone-shell">
      {tab === 'groups' && group && <section className="page groups-page">
        <header className="top-header">
          <button className="group-switch" onClick={() => setModal('group-menu')}><span>{group.emoji}</span><b>{group.name}</b><ChevronDown size={16} /></button>
          <button className="icon-button"><MoreHorizontal /></button>
        </header>
        <div className="birthday-card">
          <div><p className="eyebrow">下一个生日</p><h2>{group.members.find(m => m.id !== user.id)?.nickname || '朋友'}的心愿，提前看看</h2><p>{group.members.find(m => m.id !== user.id)?.birthday || '生日快到了'} · 礼物不必猜</p></div>
          <div className="member-stack">{group.members.slice(0, 3).map((m, i) => <span key={m.id} style={{ zIndex: 4 - i }}><Avatar profile={m} /></span>)}</div>
        </div>
        <div className="view-toolbar">
          <div className="segmented compact"><button className={status === 'active' ? 'active' : ''} onClick={() => setStatus('active')}>正在期待</button><button className={status === 'fulfilled' ? 'active' : ''} onClick={() => setStatus('fulfilled')}>已经实现</button></div>
          <label className="search-box"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索心愿" /></label>
        </div>
        <div className="section-heading"><div><p className="eyebrow">GROUP WISHES</p><h2>大家最近想要什么</h2></div><span>{visibleWishes.length}个心愿</span></div>
        <div className="wish-list">{visibleWishes.map(wish => { const owner = data.profiles.find(p => p.id === wish.ownerId)!; const claim = data.claims.find(c => c.wishId === wish.id && c.groupId === group.id)?.state; return <WishCard key={wish.id} wish={wish} owner={owner} claim={claim} isOwner={owner.id === user.id} onOpen={() => setSelectedWishId(wish.id)} /> })}</div>
        {!visibleWishes.length && <div className="empty"><Sparkles /><h3>这里还没有心愿</h3><p>记录一个想法，让朋友以后少猜一点。</p></div>}
      </section>}

      {tab === 'add' && <AddWish groups={myGroups} onSave={saveWish} onCancel={() => setTab('groups')} />}

      {tab === 'me' && <section className="page me-page">
        <header className="profile-header"><div><p className="eyebrow">MY WISH SPACE</p><h1>我的心愿库</h1></div><Avatar profile={user} size="lg" /></header>
        <div className="profile-card"><div><Avatar profile={user} size="lg" /><div><h2>{user.nickname}</h2><p>已加入 {myGroups.length} 个群组 · {data.wishes.filter(w => w.ownerId === user.id).length} 个心愿</p></div></div>{demoMode && <label className="demo-switch"><span>体验身份</span><select value={user.id} onChange={e => { setCurrentUserId(e.target.value); setSelectedWishId(null) }}>{data.profiles.map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}</select></label>}</div>
        <div className="segmented"><button className={status === 'active' ? 'active' : ''} onClick={() => setStatus('active')}>正在期待</button><button className={status === 'fulfilled' ? 'active' : ''} onClick={() => setStatus('fulfilled')}>已经实现</button></div>
        <div className="section-heading"><div><h2>{status === 'active' ? '留给未来的惊喜' : '被好好实现的愿望'}</h2><p>{status === 'active' ? '朋友只能看到你主动分享的内容' : '每一件都值得记住'}</p></div></div>
        <div className="wish-list">{data.wishes.filter(w => w.ownerId === user.id && w.status === status).map(w => <WishCard key={w.id} wish={w} owner={user} isOwner onOpen={() => { const firstGroup = myGroups.find(g => w.groupIds.includes(g.id)); if (firstGroup) setSelectedGroupId(firstGroup.id); setSelectedWishId(w.id) }} />)}</div>
        {demoMode && <button className="demo-reset" onClick={() => { setData(cloneDemo()); setCurrentUserId('u1'); setToast('体验数据已重置') }}>重置体验数据</button>}
        {!demoMode && <button className="demo-reset" onClick={() => supabase?.auth.signOut()}><LogOut size={15} />退出登录</button>}
      </section>}

      {tab !== 'add' && <nav className="bottom-nav">
        <button className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}><Users /><span>群组</span></button>
        <button className="add-fab" onClick={() => setTab('add')}><Plus /></button>
        <button className={tab === 'me' ? 'active' : ''} onClick={() => setTab('me')}><Home /><span>我的</span></button>
      </nav>}

      {selectedWish && selectedOwner && group && <WishDetail wish={selectedWish} owner={selectedOwner} group={group} user={user} claim={data.claims.find(c => c.wishId === selectedWish.id && c.groupId === group.id)?.state} onClose={() => setSelectedWishId(null)} onClaim={updateClaim} onFulfill={toggleFulfill} />}

      {modal === 'group-menu' && <div className="sheet-backdrop" onMouseDown={() => setModal(null)}><section className="mini-sheet" onMouseDown={e => e.stopPropagation()}><div className="sheet-handle" /><h2>切换群组</h2><div className="group-menu">{myGroups.map(g => <button key={g.id} className={g.id === group?.id ? 'active' : ''} onClick={() => { setSelectedGroupId(g.id); setModal(null) }}><span>{g.emoji}</span><div><b>{g.name}</b><small>{g.members.length}位成员</small></div>{g.id === group?.id && <Check />}</button>)}</div><div className="two-actions"><button className="secondary" onClick={() => setModal('group-create')}><Plus />创建群组</button><button className="secondary" onClick={() => setModal('group-join')}><Link2 />加入群组</button></div></section></div>}
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
  return <div className="sheet-backdrop"><form className="mini-sheet form-stack" onSubmit={e => { e.preventDefault(); onSubmit(value) }}><div className="sheet-handle" /><button type="button" className="sheet-close" onClick={onClose}><X /></button><h2>{type === 'create' ? '创建新的心愿群组' : '加入朋友的群组'}</h2><p>{type === 'create' ? '适合家人、朋友、情侣或任何想互相准备惊喜的人。' : '输入朋友分享给你的邀请码。'}</p><label>{type === 'create' ? '群组名称' : '邀请码'}<input autoFocus required value={value} onChange={e => setValue(e.target.value)} placeholder={type === 'create' ? '例如：周末放空小组' : 'DEMO-8K2P'} /></label><button className="primary full">{type === 'create' ? '创建群组' : '加入群组'}</button></form></div>
}

export default App
