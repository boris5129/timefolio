import { useEffect, useState, type FormEvent } from 'react'
import { LayoutDashboard, Clock3, CalendarDays, Tags, Plus, LogOut, Moon, Briefcase, BookOpen, Train, Utensils, Dumbbell, Star, Gamepad2, Video, Users, Circle, Pencil, Trash2, ChevronLeft, ChevronRight, Copy, Timer, CalendarClock, Hourglass, Layers3, X } from 'lucide-react'
import { api, ApiError, message, seoulToday } from './api'

const icons = { moon: Moon, briefcase: Briefcase, book: BookOpen, train: Train, food: Utensils, sport: Dumbbell, star: Star, game: Gamepad2, video: Video, people: Users, circle: Circle }
const iconNames = { moon: '달', briefcase: '가방', book: '책', train: '기차', food: '식기', sport: '덤벨', star: '별', game: '게임', video: '영상', people: '사람', circle: '원' }
type Category = { id: number; name: string; color: string; icon: keyof typeof icons }
type Activity = { id: number; title: string; categoryId: number; start: string; end: string; kind: 'ACTUAL' | 'PLANNED'; memo: string }
type Day = { date: string; actual: number; planned: number; unrecorded: number; available: number; primary: number; secondary: number; total: number; entries: Activity[] }
type Recent = Pick<Activity, 'title' | 'categoryId'>
type Member = { email: string }
const showMinutes = (n: number) => n >= 60 ? Math.floor(n / 60) + '시간' + (n % 60 ? ' ' + n % 60 + '분' : '') : n + '분'
const views = [{ name: '대시보드', Icon: LayoutDashboard }, { name: '시간 가계부', Icon: CalendarDays }, { name: '카테고리 관리', Icon: Tags }]
function moveDate(value: string, days: number) {
  const date = new Date(value + 'T12:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function Brand() {
  return <div className="brand"><span className="brand-icon"><Clock3 size={23}/></span>Timefolio</div>
}

export function App() {
  const [member, setMember] = useState<Member | null>()
  const [initialError, setInitialError] = useState('')
  useEffect(() => {
    api<Member>('/auth/me').then(setMember).catch(error => {
      if (error instanceof ApiError && error.status === 401) setMember(null)
      else setInitialError(message(error))
    })
  }, [])
  if (initialError) return <main className="center"><p role="alert">{initialError}</p><button onClick={() => location.reload()}>다시 시도</button></main>
  if (member === undefined) return <main className="center" role="status">불러오는 중…</main>
  return member ? <Workspace member={member} signedOut={() => setMember(null)} /> : <Auth signedIn={setMember} />
}

function Auth({ signedIn }: { signedIn: (member: Member) => void }) {
  const [register, setRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setStatus('')
    try {
      if (register) {
        await api('/auth/register', 'POST', { email, password })
        setRegister(false); setPassword(''); setStatus('가입했습니다. 로그인해 주세요.')
      } else signedIn(await api<Member>('/auth/login', 'POST', { email, password }))
    } catch (error) { setError(message(error)) }
    finally { setBusy(false) }
  }
  return <main className="auth">
    <section className="auth-intro"><Brand/><h1>시간을 아끼는 것을 넘어,<br/>원하는 삶에 투자하다.</h1><div className="clock-art" aria-hidden="true"><Clock3 size={138} strokeWidth={0.8}/></div></section>
    <section className="auth-content"><form className="auth-form" onSubmit={submit}>
      <h2>{register ? '회원가입' : '로그인'}</h2><p className="muted">{register ? '이메일로 Timefolio 계정을 만들어 보세요.' : '나의 시간 가계부에 접속하세요.'}</p>
      <label>이메일<input type="email" required maxLength={254} autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com"/></label>
      <label>비밀번호<input type="password" required minLength={8} maxLength={72} autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}{status && <p className="success" role="status">{status}</p>}
      <button className="primary" disabled={busy}>{busy ? '처리 중…' : register ? '가입하기' : '로그인'}</button>
      <button className="text-button" type="button" disabled={busy} onClick={() => { setRegister(!register); setError(''); setStatus('') }}>{register ? '로그인으로 돌아가기' : '회원가입'}</button>
    </form></section>
  </main>
}

function Workspace({ member, signedOut }: { member: Member; signedOut: () => void }) {
  const [page, setPage] = useState(0)
  const [date, setDate] = useState(seoulToday)
  const [day, setDay] = useState<Day>()
  const [categories, setCategories] = useState<Category[]>([])
  const [recent, setRecent] = useState<Recent[]>([])
  const [activity, setActivity] = useState<Partial<Activity> | null>(null)
  const [category, setCategory] = useState<Partial<Category> | null>(null)
  const [remove, setRemove] = useState<{ name: string; path: string } | null>(null)
  const [revision, refresh] = useState(0)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    Promise.all([api<Category[]>('/categories'), api<Recent[]>('/entries/recent'), api<Day>('/entries?date=' + date)])
      .then(([cats, favorites, result]) => { if (active) { setCategories(cats); setRecent(favorites); setDay(result) } })
      .catch(error => { if (active) setError(message(error)) })
    return () => { active = false }
  }, [date, revision])
  const shown = day?.date === date ? day : undefined
  const findCategory = (id: number) => categories.find(cat => cat.id === id)
  function editActivity(value: Partial<Activity>) { setFormError(''); setActivity(value) }
  function editCategory(value: Partial<Category>) { setFormError(''); setCategory(value) }
  function close() { setActivity(null); setCategory(null); setRemove(null); setFormError('') }
  async function mutate(action: () => Promise<string>, inDialog = false) {
    setBusy(true); setError(''); setFormError(''); setStatus('')
    try { setStatus(await action()); close(); refresh(n => n + 1) }
    catch (error) { (inDialog ? setFormError : setError)(message(error)) }
    finally { setBusy(false) }
  }

  return <div className="shell">
    <aside className="sidebar"><Brand/><nav aria-label="주 메뉴">{views.map(({ name, Icon }, index) =>
      <button key={name} aria-current={page === index ? 'page' : undefined} onClick={() => { setPage(index); setStatus('') }}><Icon size={19}/>{name}</button>)}</nav>
      <div className="account"><span title={member.email}>{member.email}</span><button className="icon-button" aria-label="로그아웃" title="로그아웃" disabled={busy} onClick={() => mutate(async () => { await api('/auth/logout', 'POST'); signedOut(); return '' })}><LogOut size={18}/></button></div>
    </aside>
    <main className="workspace">
      <header className="page-header"><div><h1>{views[page].name}</h1><p>{['하루의 시간 사용을 한눈에 살펴보세요.', '계획과 실제 활동을 기록하고 관리하세요.', '활동을 분류할 이름, 색상, 아이콘을 설정하세요.'][page]}</p></div>
        {page === 2 ? <button className="primary" onClick={() => editCategory({})}><Plus size={19}/>카테고리 추가</button>
        : <button className="primary" disabled={!categories.length} onClick={() => editActivity({})}><Plus size={19}/>활동 추가</button>}
      </header>
      {error && <p className="error" role="alert">{error} <button className="text-button" onClick={() => { setError(''); refresh(n => n + 1) }}>다시 시도</button></p>}
      {status && <p className="success" role="status">{status}</p>}
      {page === 2 ? <section className="panel"><h2>활동 카테고리</h2>
        {categories.length === 0 && <p className="muted">표시할 카테고리가 없습니다.</p>}
        <ul className="category-grid">{categories.map(cat => {
          const Icon = icons[cat.icon]
          return <li key={cat.id}><span className="category-icon" style={{ color: cat.color }}><Icon size={20}/></span><strong>{cat.name}</strong>
            <button className="icon-button" aria-label={cat.name + ' 수정'} onClick={() => editCategory(cat)}><Pencil size={16}/></button>
            <button className="icon-button danger" aria-label={cat.name + ' 삭제'} onClick={() => { setFormError(''); setRemove({ name: cat.name, path: '/categories/' + cat.id }) }}><Trash2 size={16}/></button>
          </li>
        })}</ul></section> : <>
        <div className="date-bar"><div className="date-controls">
          <button className="icon-button" aria-label="이전 날짜" onClick={() => setDate(moveDate(date, -1))}><ChevronLeft size={19}/></button>
          <input type="date" aria-label="조회 날짜" value={date} min="1901-01-01" max="9998-12-31" onChange={e => { if (e.target.value && e.target.validity.valid) setDate(e.target.value) }} />
          <button className="icon-button" aria-label="다음 날짜" onClick={() => setDate(moveDate(date, 1))}><ChevronRight size={19}/></button>
          <button onClick={() => setDate(seoulToday())}>오늘</button>
        </div>{page === 1 && <button disabled={busy} onClick={() => mutate(async () => {
          const result = await api<{ created: number }>('/entries/copy', 'POST', { date })
          return result.created ? result.created + '개 활동을 계획으로 복사했습니다.' : '복사할 새 활동이 없습니다.'
        })}><Copy size={16}/>전날 활동 복사</button>}</div>
        {!shown ? !error && <p role="status">활동을 불러오는 중…</p> : <>
          <Summary day={shown}/>
          {page === 1 && recent.length > 0 && <section className="panel quick"><h2>최근 활동 빠른 등록</h2>{recent.map(row =>
            <button key={row.categoryId + ':' + row.title} onClick={() => editActivity(row)}><Plus size={15}/>{row.title}</button>)}</section>}
          <section className="panel"><div className="panel-heading"><h2>하루 타임라인</h2><span className="muted">{shown.entries.length}개 활동</span></div>
            {!shown.entries.length ? <div className="empty"><CalendarDays size={30}/><h3>아직 기록된 활동이 없어요</h3><p>선택한 날짜에 활동을 추가해 보세요.</p></div> :
            <ul className="timeline">{shown.entries.map(entry => {
              const cat = findCategory(entry.categoryId)
              const Icon = cat ? icons[cat.icon] : Circle
              const dayStart = date + 'T00:00'
              const nextStart = moveDate(date, 1) + 'T00:00'
              return <li key={entry.id}><time>{entry.start < dayStart ? '00:00' : entry.start.slice(11, 16)} – {entry.end >= nextStart ? '24:00' : entry.end.slice(11, 16)}</time>
                <span className="category-icon" style={{ color: cat?.color }}><Icon size={19}/></span>
                <div className="entry-description"><strong>{entry.title}</strong><p>{cat?.name}{entry.memo && ' · ' + entry.memo}</p></div>
                <span className={'badge ' + entry.kind.toLowerCase()}>{entry.kind === 'ACTUAL' ? '실제' : '계획'}</span>
                <div className="row-actions"><button className="icon-button" aria-label={entry.title + ' 수정'} onClick={() => editActivity(entry)}><Pencil size={16}/></button>
                <button className="icon-button danger" aria-label={entry.title + ' 삭제'} onClick={() => { setFormError(''); setRemove({ name: entry.title, path: '/entries/' + entry.id }) }}><Trash2 size={16}/></button></div></li>
            })}</ul>}
          </section>
        </>}
      </>}
      {activity && <Modal heading={activity.id ? '활동 수정' : '활동 추가'} close={close} busy={busy}>
        <form onSubmit={e => { e.preventDefault(); const values = new FormData(e.currentTarget); void mutate(async () => {
          const payload = { ...Object.fromEntries(values), categoryId: Number(values.get('categoryId')) }
          await api('/entries' + (activity.id ? '/' + activity.id : ''), activity.id ? 'PUT' : 'POST', payload)
          return '활동을 저장했습니다.'
        }, true) }}>
          <label>활동 이름<input name="title" required maxLength={100} defaultValue={activity.title} autoFocus/></label>
          <div className="field-row"><label>카테고리<select name="categoryId" required defaultValue={activity.categoryId}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>기록 종류<select name="kind" defaultValue={activity.kind ?? 'ACTUAL'}><option value="ACTUAL">실제 활동</option><option value="PLANNED">예정된 활동</option></select></label></div>
          <div className="field-row"><label>시작 시각<input name="start" type="datetime-local" required defaultValue={activity.start?.slice(0, 16) ?? date + 'T09:00'}/></label>
          <label>종료 시각<input name="end" type="datetime-local" required defaultValue={activity.end?.slice(0, 16) ?? date + 'T10:00'}/></label></div>
          <label>메모<textarea name="memo" maxLength={500} rows={3} defaultValue={activity.memo}/></label>
          <FormActions busy={busy} close={close} error={formError}/>
        </form>
      </Modal>}
      {category && <Modal heading={category.id ? '카테고리 수정' : '카테고리 추가'} close={close} busy={busy}>
        <form onSubmit={e => { e.preventDefault(); const payload = Object.fromEntries(new FormData(e.currentTarget)); void mutate(async () => {
          await api('/categories' + (category.id ? '/' + category.id : ''), category.id ? 'PUT' : 'POST', payload)
          return '카테고리를 저장했습니다.'
        }, true) }}>
          <label>카테고리 이름<input name="name" required maxLength={40} defaultValue={category.name} autoFocus/></label>
          <div className="field-row"><label>색상<input name="color" type="color" defaultValue={category.color ?? '#4f46e5'}/></label>
          <label>아이콘<select name="icon" defaultValue={category.icon ?? 'circle'}>{Object.entries(iconNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></div>
          <FormActions busy={busy} close={close} error={formError}/>
        </form>
      </Modal>}
      {remove && <Modal heading="삭제 확인" close={close} busy={busy}>
        <form onSubmit={e => { e.preventDefault(); void mutate(async () => { await api(remove.path, 'DELETE'); return '삭제했습니다.' }, true) }}>
          <p>‘{remove.name}’ 항목을 삭제할까요?</p><FormActions busy={busy} close={close} error={formError} destructive/>
        </form></Modal>}
    </main>
  </div>
}

export function Summary({ day }: { day: Day }) {
  const metrics = [
    { title: '실제 기록 시간', value: day.actual, Icon: Timer, color: 'indigo' },
    { title: '예정 활동 시간', value: day.planned, Icon: CalendarClock, color: 'sky' },
    { title: '미기록 시간', value: day.unrecorded, Icon: Hourglass, color: 'slate' },
    { title: '계획 가능 시간', value: day.available, Icon: Layers3, color: 'teal' },
  ]
  return <><section aria-label="하루 시간 요약" className="metrics">{metrics.map(({ title, value, Icon, color }) =>
    <article className="metric" key={title}><span className={'metric-icon ' + color}><Icon size={21}/></span><h2>{title}</h2><strong>{showMinutes(value)}</strong></article>)}</section>
    <section className="panel usage"><div className="panel-heading"><h2>하루 사용 현황</h2><span className="muted">총 {showMinutes(day.total)}</span></div>
    <div className="progress" role="progressbar" aria-label="실제 기록 시간" aria-valuenow={day.actual} aria-valuemax={day.total}><span style={{ width: day.actual / day.total * 100 + '%' }}/></div>
    <div className="usage-labels"><span>주 활동 {showMinutes(day.primary)}</span><span>보조 활동 {showMinutes(day.secondary)}</span></div></section></>
}

function Modal({ heading, close, busy, children }: { heading: string; close: () => void; busy: boolean; children: React.ReactNode }) {
  useEffect(() => {
    const dialog = document.getElementById('edit-dialog') as HTMLDialogElement
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return <dialog id="edit-dialog" aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); if (!busy) close() }}>
    <div className="panel-heading"><h2 id="dialog-title">{heading}</h2><button className="icon-button" aria-label="닫기" disabled={busy} onClick={close}><X size={20}/></button></div>{children}
  </dialog>
}

function FormActions({ busy, close, error, destructive }: { busy: boolean; close: () => void; error: string; destructive?: boolean }) {
  return <>{error && <p className="error" role="alert">{error}</p>}<div className="form-actions">
    <button type="button" disabled={busy} onClick={close}>취소</button><button className={destructive ? 'delete-button' : 'primary'} disabled={busy}>{busy ? '처리 중…' : destructive ? '삭제' : '저장'}</button>
  </div></>
}
