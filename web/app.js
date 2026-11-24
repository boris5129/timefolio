/* global Timefolio */
const $ = id => document.getElementById(id)
const element = (tag, value, className) => {
  const node = document.createElement(tag)
  if (value !== undefined) node.textContent = value
  if (className) node.className = className
  return node
}
const button = (label, click, accessibleName) => {
  const node = element('button', label)
  node.type = 'button'
  if (accessibleName) node.setAttribute('aria-label', accessibleName)
  node.addEventListener('click', click)
  return node
}
const duration = n => n < 60 ? n + '분' : Math.floor(n / 60) + '시간' + (n % 60 ? ' ' + n % 60 + '분' : '')
const time = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0')
const pages = {
  home: ['대시보드', ''],
  saved: ['시간 확보', '직접 확인한 절약 시간을 날짜별로 기록합니다.'],
  settings: ['설정', '기록 저장 방식과 카테고리를 확인합니다.'],
  stack: ['시간 중첩', '같은 시간에 진행한 실제 활동과 대체한 계획을 확인합니다.'],
  invest: ['시간 재투자', ''],
  wish: ['하고 싶은 일', ''],
  goals: ['목표 관리', ''],
  simulate: ['미래 시뮬레이션', ''],
  statistics: ['통계 및 결산', '실제 기록, 계획, 아낀 시간을 기간별로 비교합니다.'],
  account: ['로그인 및 회원가입', ''],
  register: ['활동 등록', '기록할 날짜를 먼저 골라 주세요.'],
  day: ['오늘의 활동', ''],
  week: ['주간 활동', '월요일부터 일요일까지'],
  month: ['월간 활동', '날짜를 누르면 그날의 활동 내역으로 이동합니다.'],
  categories: ['카테고리', '활동에 사용할 이름, 색상, 아이콘을 관리합니다.'],
}
const featureStatus = {
  invest: ['시간 재투자 기능을 준비 중입니다', '재투자 기능이 열리기 전까지는 직접 확인한 절약 시간을 기록할 수 있습니다.', '시간 확보 기록 보기', 'saved'],
  wish: ['하고 싶은 일 목록을 준비 중입니다', '하고 싶은 활동을 지금은 시간 가계부에 계획으로 등록할 수 있습니다.', '활동 등록', 'register'],
  goals: ['개인 목표 관리 기능을 준비 중입니다', '카테고리마다 하루 목표 시간을 정하고 실제 사용량과 비교할 수 있습니다.', '카테고리 목표 설정', 'categories'],
  simulate: ['미래 시뮬레이션을 준비 중입니다', '월간 활동에서 등록한 미래 계획을 확인할 수 있습니다.', '월간 활동 보기', 'month'],
  account: ['이 브라우저에서 바로 사용할 수 있습니다', '현재 기록은 브라우저에 저장됩니다. 로그인과 기기 간 동기화는 준비 중입니다.', '설정으로 돌아가기', 'settings'],
}
const pageFromHash = () => {
  const target = location.hash.slice(1)
  return Object.hasOwn(pages, target) ? target : 'home'
}
let state
let page = pageFromHash()
let filter = 'all'
let statisticsKind = 'month'
const periodKind = () => page === 'statistics' ? statisticsKind : page
let selecting = false
const selectedEntries = new Set()
const weekdays = ['월','화','수','목','금','토','일']
const dayLabel = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full', timeZone: 'UTC' })
let editing
let deleting
const editor = $('editor')
const fields = $('edit-form').elements
const date = $('date')

function notify(id, text = '') {
  $(id).textContent = text
  $(id).hidden = !text
}
function load() {
  $('loading').hidden = true
  try {
    state = Timefolio.read(localStorage)
    notify('error')
    render()
  } catch {
    state = undefined
    $('add').disabled = true
    $('copy').disabled = true
    for (const id of ['register-actual', 'register-plan', 'register-repeat']) $(id).disabled = true
    for (const id of ['summary', 'daily', 'activity-list', 'categories', 'register', 'savings', 'period', 'category-budget', 'dashboard', 'settings', 'feature-status', 'saving-history', 'overlap-summary', 'day-review']) $(id).hidden = true
    notify('error', '이 브라우저의 기록을 읽을 수 없습니다. 브라우저 저장 설정을 확인해 주세요.')
  }
}
function commit(update) {
  const next = Timefolio.read(localStorage)
  const result = update(next)
  try { Timefolio.save(localStorage, next) }
  catch { throw new Error('기록을 저장하지 못했습니다. 브라우저 저장 공간과 설정을 확인해 주세요.') }
  state = next
  render()
  return result
}
function render() {
  if (!state) return
  const selected = date.value
  const categoryPage = page === 'categories'
  const dailyPage = page === 'day'
  const registerPage = page === 'register'
  const savingsPage = page === 'saved'
  const overlapPage = page === 'stack'
  const dashboardPage = page === 'home'
  const feature = featureStatus[page]
  document.title = pages[page][0] + ' | Timefolio'
  const periodPage = ['week', 'month', 'statistics'].includes(page)
  $('page-title').closest('main').dataset.view = page
  $('statistics-picker').hidden = page !== 'statistics'
  $('page-title').textContent = dailyPage && selected !== Timefolio.today() ? '날짜별 활동' : pages[page][0]
  const dateDescription = dashboardPage ? Timefolio.today() : selected
  $('page-description').textContent = dailyPage || dashboardPage
    ? dayLabel.format(new Date(dateDescription + 'T00:00:00Z')) : pages[page][1]
  $('page-description').hidden = !$('page-description').textContent
  $('dashboard').hidden = !dashboardPage
  $('settings').hidden = page !== 'settings'
  $('feature-status').hidden = !feature
  for (const item of document.querySelectorAll('[data-page]')) {
    if (item.dataset.page === page) item.setAttribute('aria-current', 'page')
    else item.removeAttribute('aria-current')
  }
  if (dashboardPage) renderDashboard(dateDescription)
  if (feature) {
    const [title, description, action, target] = feature
    $('feature-status-title').textContent = title
    $('feature-status-text').textContent = description
    $('feature-action').textContent = action
    $('feature-action').dataset.go = target
  }
  $('add').hidden = !categoryPage
  $('add').disabled = false
  for (const id of ['register-actual','register-plan','register-repeat']) $(id).disabled = state.categories.length === 0
  $('copy').disabled = false
  $('copy').hidden = !registerPage
  $('prev').disabled = !Timefolio.validDate(Timefolio.shiftDate(selected, -1))
  $('next').disabled = !Timefolio.validDate(Timefolio.shiftDate(selected, 1))
  $('date-section').hidden = !dailyPage && !registerPage && !savingsPage && !overlapPage
  $('day-review').hidden = !dailyPage || selected >= Timefolio.today()
  const summary = dailyPage || savingsPage || overlapPage ? Timefolio.day(state, selected) : null
  const overlap = summary ? Timefolio.overlapSaving(state, selected, summary) : null
  $('overlap-summary').hidden = !overlapPage && !overlap?.overlap
  if (overlap) renderOverlap(overlap)
  for (const id of ['summary', 'daily', 'activity-list', 'category-budget']) $(id).hidden = !dailyPage
  $('savings').hidden = !dailyPage && !savingsPage
  $('saving-history').hidden = !savingsPage
  if (savingsPage) renderSavingHistory()
  $('categories').hidden = !categoryPage
  $('register').hidden = !registerPage
  $('period').hidden = !periodPage
  if (categoryPage) renderCategories()
  if (registerPage) {
    $('clock-register-date').textContent = shortDate(selected)
    for (const hour of $('register-clock').querySelectorAll('button')) hour.disabled = state.categories.length === 0
    renderRecent()
    renderRecurring()
  }
  if (periodPage) renderPeriod(selected)
  $('holiday-warning').hidden = !(dailyPage || periodPage) || Timefolio.holidayKnown(selected) ||
    !(state.recurring ?? []).some(rule => rule.skipHolidays && !rule.stopDate)
  if (dailyPage || savingsPage) {
    const saved = Timefolio.saving(state, selected)
    $('saving-label').textContent = selected === Timefolio.today() ? '오늘 아낀 시간' : '이날 아낀 시간'
    $('saving-value').textContent = duration(saved.minutes)
    $('saving-note').textContent = saved.note || (saved.minutes ? '' : '기록된 절약 시간이 없습니다.')
    $('saving-edit').textContent = saved.minutes ? '기록 수정' : '아낀 시간 기록'
    if (dailyPage) renderDay(summary)
  }
}
function renderSavingHistory() {
  const rows = Object.entries(state.savings ?? {}).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7)
  $('saving-history-list').replaceChildren(...(rows.length ? rows.map(([date, item]) => {
    const line = element('li')
    const detail = element('span')
    detail.append(element('strong', date), element('span', item.note, 'muted'))
    const open = button('', () => showDate(date))
    open.append(detail, element('strong', duration(item.minutes), 'history-value'))
    line.append(open)
    return line
  }) : [element('li', '저장한 절약 기록이 여기에 표시됩니다.', 'muted')]))
}
function renderDashboard(today) {
  const day = Timefolio.day(state, today)
  const saved = Timefolio.saving(state, today)
  $('dash-used').textContent = duration(day.actual)
  $('dash-progress').style.width = day.actual / 14.4 + '%'
  $('dash-unrecorded').textContent = duration(day.unrecorded)
  $('dash-planned').textContent = duration(day.planned)
  $('dash-saved').textContent = duration(saved.minutes)
  $('dash-stacked').textContent = duration(Timefolio.overlapSaving(state, today, day).confirmed)
  $('dash-timeline-empty').hidden = Boolean(day.rows.length)
  const categories = new Map(state.categories.map(category => [category.id, category]))
  for (const kind of ['actual', 'planned']) {
    const rail = $('dash-' + kind + '-rail')
    rail.replaceChildren(...day.rows.filter(row => row.kind === kind).map(row => {
      const segment = element('span')
      segment.style.insetInlineStart = row.first / 14.4 + '%'
      segment.style.width = (row.last - row.first) / 14.4 + '%'
      segment.style.background = categories.get(row.categoryId)?.color ?? '#3182f6'
      segment.title = time(row.first) + '–' + time(row.last) + ' ' + row.title
      segment.setAttribute('aria-hidden', 'true')
      return segment
    }))
  }
  const agenda = day.rows.slice(0, 4).map(row => {
    const item = element('li')
    const detail = element('div')
    detail.append(element('strong', row.title), element('span', time(row.first) + '–' + time(row.last), 'muted'))
    item.append(detail, element('span', row.kind === 'actual' ? '실제' : '계획', 'pill ' + row.kind))
    return item
  })
  $('dash-agenda').replaceChildren(...(agenda.length ? agenda : [element('li', '아직 기록된 활동이 없어요', 'muted')]))
}
function mark(category) {
  const badge = element('span', category.icon, 'category-icon')
  badge.style.color = category.color
  badge.setAttribute('aria-hidden', 'true')
  return badge
}
function renderCategories() {
  const items = state.categories.map(category => {
    const row = element('li')
    const details = element('div', undefined, 'category-details')
    details.append(element('strong', category.name))
    if (category.budgetMinutes != null) details.append(element('span', '하루 목표 ' + duration(category.budgetMinutes), 'muted'))
    row.append(mark(category), details,
      button('수정', () => openEditor('category', category), category.name + ' 수정'),
      button('삭제', () => confirmDelete('category', category), category.name + ' 삭제'))
    return row
  })
  $('category-list').replaceChildren(...(items.length ? items : [element('li', '등록된 카테고리가 없습니다.', 'muted')]))
}
function renderDay(day) {
  const metrics = [['실제 기록 시간', day.actual], ['예정 활동 시간', day.planned], ['미기록 시간', day.unrecorded], ['계획 가능 시간', day.available]]
  $('summary').replaceChildren(...metrics.map(([name, value], i) => {
    const card = element('article', undefined, 'metric metric-' + i)
    card.append(element('h2', name), element('strong', duration(value)))
    return card
  }))
  renderBudget(day)
  renderClock(day)
  if (!$('day-review').hidden) renderReview(day)
  renderEntries(day)
}

function renderOverlap(result) {
  $('overlap-total').textContent = duration(result.overlap)
  $('overlap-confirmed').textContent = duration(result.confirmed)
  $('overlap-message').textContent = result.chosen ? '대체 확인: ' + result.chosen.title
    : result.candidates.length ? '겹쳐서 수행한 활동이 별도 계획을 대체했다면 아래에서 확인하세요.'
    : result.overlap ? '겹친 활동과 이름·카테고리가 같은 별도 계획이 있어야 절약을 확인할 수 있습니다.'
    : '이 날짜에 겹쳐 기록된 서로 다른 실제 활동이 없습니다.'
  $('overlap-form').hidden = !result.candidates.length || Boolean(result.chosen)
  $('overlap-clear').hidden = !result.chosen
  $('overlap-plan').replaceChildren(...result.candidates.map(row => {
    const option = element('option', row.title + ' · ' + time(row.first) + '–' + time(row.last) + ' · ' + duration(row.minutes) + ' 절약')
    option.value = row.id
    return option
  }))
}
function confirmOverlap(id) {
  try {
    commit(next => Timefolio.setOverlapConfirmation(next, date.value, id))
    notify('notice', id ? '중첩 절약을 확인했습니다.' : '중첩 절약 확인을 취소했습니다.')
  } catch (error) { notify('error', error.message) }
}
$('overlap-form').onsubmit = event => {
  event.preventDefault()
  confirmOverlap($('overlap-plan').value)
}
$('overlap-clear').onclick = () => confirmOverlap(null)

function renderReview(day) {
  const review = Timefolio.dayReview(state, day)
  const notes = []
  if (!day.actual) notes.push(['계획 이행', '실제 활동 기록이 없어 이 날의 일과를 평가할 수 없습니다.'])
  else if (review.percentage === null) notes.push(['계획 이행', '비교할 계획이 없습니다.'])
  else if (review.percentage === 100) notes.push(['계획 이행', '계획한 시간을 모두 같은 활동으로 보냈어요.'])
  else notes.push(['계획 이행', '계획한 시간 중 ' + duration(review.matched) + '(' + review.percentage + '%)를 같은 활동에 썼어요.'])
  if (day.actual) {
    const reference = row => row.category.budgetMinutes != null ? '목표' : '계획'
    for (const row of review.rest) {
      const feedback = row.target && row.actual >= row.target ? '기준보다 적지 않게 쉴 시간을 챙겼어요.'
        : row.target ? reference(row) + '보다 ' + duration(row.target - row.actual) + ' 적게 기록됐어요.'
        : duration(row.actual) + ' 기록했어요.'
      notes.push([row.category.name, feedback])
    }
    for (const row of review.leisure) {
      const feedback = row.target && row.actual > row.target ? reference(row) + '보다 ' + duration(row.actual - row.target) + ' 더 썼어요.'
        : row.target ? reference(row) + ' 범위에서 시간을 썼어요. 실제 ' + duration(row.actual) + '.'
        : duration(row.actual) + ' 기록했어요. 목표를 설정하면 비교할 수 있습니다.'
      notes.push([row.category.name, feedback])
    }
  }
  $('review-items').replaceChildren(...notes.map(([label, message]) => {
    const row = element('li')
    row.append(element('strong', label), element('p', message))
    return row
  }))
}

function renderBudget(day) {
  const rows = Timefolio.categoryUsage(state, day).map(({ category, actual, target }) => {
    const row = element('li')
    const label = element('strong', undefined, 'budget-label')
    label.append(mark(category), element('span', category.name))
    const details = element('div', undefined, 'budget-value')
    details.append(element('strong', duration(actual)), element('span', target
      ? ' / ' + (category.budgetMinutes != null ? '목표 ' : '계획 ') + duration(target)
      : ' / 목표 미설정', 'muted'))
    if (target && actual > target) details.append(element('span', duration(actual - target) + ' 초과', 'budget-over'))
    const header = element('div', undefined, 'budget-header')
    header.append(label, details)
    row.append(header)
    if (target) {
      const meter = element('progress', undefined, 'budget-meter')
      meter.max = target
      meter.value = Math.min(actual, target)
      meter.style.setProperty('--budget-color', actual > target ? '#a12e43' : category.color)
      meter.setAttribute('aria-label', category.name + ' 시간 예산')
      meter.setAttribute('aria-valuetext', details.textContent)
      row.append(meter)
    }
    return row
  })
  $('budget-rows').replaceChildren(...(rows.length ? rows : [
    element('li', '활동을 기록하거나 카테고리에 하루 목표를 설정하면 여기에 표시됩니다.', 'muted'),
  ]))
}
$('budget-settings').onclick = () => selectPage('categories')

function positionOnClock(node, hour) {
  const angle = hour * Math.PI / 12
  node.style.left = 50 + Math.sin(angle) * 44 + '%'
  node.style.top = 50 - Math.cos(angle) * 44 + '%'
}
function openAt(hour) {
  const kind = document.querySelector('[name="clock-kind"]:checked').value
  const selected = date.value
  const nextDay = Timefolio.shiftDate(selected, 1)
  const start = selected + 'T' + time(hour * 60)
  const end = hour < 23 ? selected + 'T' + time((hour + 1) * 60)
    : Timefolio.validDate(nextDay) ? nextDay + 'T00:00' : selected + 'T23:59'
  openEditor('entry', { kind, start, end })
}
function buildClocks() {
  for (let hour = 0; hour < 24; hour++) {
    const label = String(hour).padStart(2, '0')
    const pick = button(label, () => openAt(hour), label + ':00에 등록')
    pick.className = 'clock-hour'
    positionOnClock(pick, hour)
    $('register-clock').append(pick)
    if (hour % 3 === 0) {
      const tick = element('span', label, 'clock-tick')
      tick.setAttribute('aria-hidden', 'true')
      positionOnClock(tick, hour)
      $('day-clock').append(tick)
    }
  }
}
function renderClock(day) {
  const categories = new Map(state.categories.map(item => [item.id, item]))
  const colorOf = row => categories.get(row.categoryId)?.color ?? '#28543b'
  for (const kind of ['actual', 'planned']) {
    const rows = day.rows.filter(row => row.kind === kind)
    const stops = [...new Set([0, 1440, ...rows.flatMap(row => [row.first, row.last])])].sort((a, b) => a - b)
    const arcs = stops.slice(0, -1).map((start, index) => {
      const end = stops[index + 1]
      const row = rows.findLast(row => row.first <= start && row.last >= end)
      const color = row ? colorOf(row) : '#e2e9fb'
      return color + ' ' + (start / 4) + 'deg ' + (end / 4) + 'deg'
    })
    $('clock-' + kind).style.backgroundImage = 'conic-gradient(' + arcs.join(', ') + ')'
  }
  $('clock-date').textContent = shortDate(date.value)
  $('clock-total').textContent = '실제 ' + duration(day.actual)
  $('day-clock').setAttribute('aria-label', '24시간 생활계획표. 바깥쪽 실제 ' + duration(day.actual) + ', 안쪽 계획 ' + duration(day.planned) + '. 세부 내용은 활동 내역에 표시됩니다.')
  const items = [...new Set(day.rows.map(row => row.categoryId))].filter(id => categories.has(id)).map(id => {
    const category = categories.get(id)
    const item = element('li')
    const ink = element('span', undefined, 'clock-swatch')
    ink.style.backgroundColor = category.color
    item.append(ink, element('span', category.name))
    return item
  })
  $('clock-categories').replaceChildren(...items)
}

function renderRecurring() {
  const active = (state.recurring ?? []).filter(rule => !rule.stopDate)
  $('recurring-section').hidden = !active.length
  const labels = { daily: '매일', weekdays: '평일' }
  const list = active.map(rule => {
    const row = element('li')
    const schedule = labels[rule.frequency] ?? (rule.frequency === 'monthly' ? '매월 ' + rule.monthDay + '일'
      : weekdays.filter((_, index) => rule.weekdays.includes((index + 1) % 7)).join('·'))
    const description = element('div')
    const title = rule.templates.map(step => step.title).join(' · ')
    description.append(element('strong', title), element('p', rule.startDate + '부터 · ' + schedule + ' · ' + rule.start + '–' + rule.end +
      (rule.skipHolidays ? ' · 공휴일 제외' : ''), 'muted'))
    const stop = button('중단', () => {
      deleting = { type: 'rule', id: rule.id, date: date.value }
      notify('confirm-error')
      $('confirm-title').textContent = '반복 중단 확인'
      $('confirm-submit').textContent = '중단'
      $('confirm-message').textContent = title + ' 반복을 ' + date.value + '부터 중단할까요?'
      $('confirm').showModal()
    }, title + ' 반복 중단')
    row.append(description, stop)
    return row
  })
  $('recurring-list').replaceChildren(...list)
}

function renderRecent() {
  const recent = new Map()
  for (const row of [...state.entries].reverse()) {
    const key = JSON.stringify([row.title, row.categoryId])
    if (!recent.has(key)) recent.set(key, row)
    if (recent.size >= 5) break
  }
  $('quick').hidden = recent.size === 0
  $('quick-items').replaceChildren(...Array.from(recent.values(), row =>
    button(row.title, () => openEditor('entry', { title: row.title, categoryId: row.categoryId }))))
}
function renderEntries(day) {
  const rows = day.rows.filter(row => filter === 'all' || row.kind === filter)
  const lookup = new Map(state.categories.map(item => [item.id, item]))
  $('count').textContent = rows.length + '개 활동'
  $('bulk-actions').hidden = day.rows.length === 0
  const visibleIds = new Set(rows.map(row => row.id))
  for (const id of selectedEntries) if (!visibleIds.has(id)) selectedEntries.delete(id)
  updateSelection(rows)
  if (!rows.length) {
    const empty = element('div', undefined, 'empty')
    empty.append(element('h3', filter === 'all' ? '아직 기록된 활동이 없어요' : '이 종류의 활동이 없습니다.'))
    if (filter === 'all') empty.append(button('활동 등록', () => selectPage('register')))
    $('entries').replaceChildren(empty)
    return
  }
  const list = element('ul', undefined, 'entry-list')
  for (const row of rows) {
    const item = element('li')
    const category = lookup.get(row.categoryId)
    const content = element('div', undefined, 'entry-content')
    content.append(button(row.title, () => openEditor('entry', row)), element('p',
      [category?.name, duration(row.last - row.first), row.memo].filter(Boolean).join(' · '), 'muted'))
    const actions = element('div', undefined, 'row-actions')
    actions.append(button('수정', () => openEditor('entry', row), row.title + ' 수정'),
      button('삭제', () => confirmDelete('entry', row), row.title + ' 삭제'))
    if (selecting) {
      const check = element('input', undefined, 'entry-check')
      check.type = 'checkbox'
      check.setAttribute('aria-label', row.title + ' 선택')
      check.checked = selectedEntries.has(row.id)
      check.dataset.entryId = row.id
      check.onchange = () => {
        if (check.checked) selectedEntries.add(row.id)
        else selectedEntries.delete(row.id)
        updateSelection(rows)
      }
      item.append(check)
    }
    item.classList.toggle('selecting', selecting)
    item.append(element('span', time(row.first) + ' – ' + time(row.last), 'entry-time'),
      mark(category ?? { icon: '●', color: '#4a47d7' }), content,
      element('span', row.kind === 'actual' ? '실제' : '계획', 'pill ' + row.kind), actions)
    list.append(item)
  }
  $('entries').replaceChildren(list)
}
function updateSelection(rows) {
  $('select-mode').textContent = selecting ? '선택 취소' : '활동 선택'
  $('select-mode').setAttribute('aria-pressed', selecting)
  $('select-visible').hidden = !selecting || rows.length === 0
  $('delete-selected').hidden = !selecting
  $('delete-selected').disabled = !selectedEntries.size
  $('delete-selected').textContent = '선택 삭제' + (selectedEntries.size ? ' (' + selectedEntries.size + ')' : '')
}
function clearSelection() {
  selecting = false
  selectedEntries.clear()
}
function confirmBulk(rows, entireDay) {
  if (!rows.length) return
  deleting = { type: 'bulk', ids: new Set(rows.map(row => row.id)) }
  $('confirm-title').textContent = '삭제 확인'
  $('confirm-submit').textContent = '삭제'
  const crossesMidnight = rows.some(row => row.start.slice(0, 10) !== row.end.slice(0, 10))
  const scope = entireDay ? date.value + '의 실제 활동과 계획 전체 ' : '선택한 활동 '
  notify('confirm-error')
  $('confirm-message').textContent = scope + rows.length + '개를 삭제할까요?' +
    (crossesMidnight ? ' 자정을 넘는 기록은 다른 날짜에서도 함께 사라집니다.' : '')
  $('confirm').showModal()
}

function monthShift(value, direction) {
  const stamp = new Date(value.slice(0, 7) + '-01T00:00:00Z')
  stamp.setUTCMonth(stamp.getUTCMonth() + direction)
  return stamp.toISOString().slice(0, 10)
}
const shortDate = value => value.slice(5).replace('-', '.')
function renderPeriod(value) {
  const kind = periodKind()
  const { days, totals, offset } = Timefolio.period(state, value, kind)
  const weekly = kind === 'week'
  const today = Timefolio.today()
  $('period').classList.toggle('weekly', weekly)
  $('period-title').textContent = weekly ? shortDate(days[0].date) + '–' + shortDate(days.at(-1).date) : value.slice(0, 4) + '년 ' + Number(value.slice(5, 7)) + '월'
  $('period-current').textContent = weekly ? '이번 주' : '이번 달'
  $('period-prev').disabled = !Timefolio.validDate(weekly ? Timefolio.shiftDate(value, -7) : monthShift(value, -1))
  $('period-next').disabled = !Timefolio.validDate(weekly ? Timefolio.shiftDate(value, 7) : monthShift(value, 1))
  $('period-totals').replaceChildren(...[['실제', totals.actual], ['계획', totals.planned], ['아낀 시간', totals.saved], ...(totals.stacked ? [['중첩 절약', totals.stacked]] : [])].map(([label, amount]) => {
    const total = element('div')
    total.append(element('span', label), element('strong', duration(amount)))
    return total
  }))
  const cells = weekdays.map((value, index) => element('span', value, 'weekday' + (index === 5 ? ' saturday' : index === 6 ? ' holiday' : '')))
  for (let i = 0; i < offset; i++) cells.push(element('div', undefined, 'calendar-gap'))
  for (const [index, row] of days.entries()) {
    const weekday = (index + offset) % 7
    const holiday = Timefolio.isHoliday(row.date)
    const cell = button('', () => { showDate(row.date); selectPage('day'); $('page-title').focus() },
      row.date + ' · 실제 ' + duration(row.actual) + ' · 계획 ' + duration(row.planned) + ' · 아낀 시간 ' + duration(row.saved) +
      (row.stacked ? ' · 중첩 절약 ' + duration(row.stacked) : '') + (holiday ? ' · 공휴일' : weekday === 5 ? ' · 토요일' : weekday === 6 ? ' · 일요일' : ''))
    cell.disabled = !Timefolio.validDate(row.date)
    cell.className = 'calendar-day' + (holiday || weekday === 6 ? ' holiday' : weekday === 5 ? ' saturday' : '')
    if (row.date === today) cell.setAttribute('aria-current', 'date')
    cell.append(element('strong', Number(row.date.slice(-2)) + '일', 'calendar-number'))
    if (weekly) cell.append(element('span', weekdays[index] + '요일', 'calendar-weekday'))
    if (holiday) cell.append(element('span', '공휴일', 'calendar-holiday'))
    for (const [label, amount, kind] of [['실제', row.actual, 'actual'], ['계획', row.planned, 'planned'], ['절약', row.saved, 'saved'], ['중첩', row.stacked, 'saved']]) {
      if (!amount) continue
      const detail = element('span', undefined, 'calendar-detail ' + kind)
      detail.append(element('span', label, 'calendar-detail-label'), element('span', ' ' + duration(amount), 'calendar-detail-value'))
      cell.append(detail)
    }
    cells.push(cell)
  }
  $('period-grid').replaceChildren(...cells)
}
function openEditor(type, row = {}) {
  editing = { type, id: row.id, sourceDate: row.start?.slice(0, 10) }
  const isEntry = type === 'entry'
  $('edit-form').reset()
  const title = isEntry ? (row.kind === 'planned' ? '계획' : '실제 활동') : '카테고리'
  $('editor-title').textContent = title + (row.id ? ' 수정' : ' 추가')
  fields.kind.closest('label').hidden = !row.id
  for (const [id, active] of [['entry-fields', isEntry], ['category-fields', !isEntry]]) {
    $(id).hidden = !active
    for (const control of $(id).querySelectorAll('input, textarea, select')) control.disabled = !active
  }
  if (isEntry) {
    fields.categoryId.replaceChildren(...state.categories.map(category => {
      const option = element('option', category.name)
      option.value = category.id
      return option
    }))
    fields.title.value = row.title ?? ''
    fields.categoryId.value = row.categoryId ?? state.categories[0]?.id ?? ''
    fields.start.value = row.start ?? date.value + 'T09:00'
    fields.end.value = row.end ?? date.value + 'T10:00'
    fields.kind.value = row.kind ?? 'actual'
    fields.memo.value = row.memo ?? ''
  } else {
    fields.namedItem('name').value = row.name ?? ''
    fields.color.value = row.color ?? '#4a47d7'
    fields.icon.value = row.icon ?? '●'
    fields.budgetMinutes.value = row.budgetMinutes ?? ''
  }
  notify('edit-error')
  editor.showModal()
  const first = isEntry ? fields.title : fields.namedItem('name')
  first.focus()
}
function confirmDelete(type, row) {
  deleting = { type, id: row.id }
  $('confirm-title').textContent = '삭제 확인'
  $('confirm-submit').textContent = '삭제'
  notify('confirm-error')
  $('confirm-message').textContent = '‘' + (row.title ?? row.name) + '’ 항목을 삭제할까요?'
  $('confirm').showModal()
}
$('edit-form').addEventListener('submit', event => {
  event.preventDefault()
  const input = Object.fromEntries(new FormData(event.currentTarget))
  try {
    commit(next => {
      const { id, type } = editing
      const sourceDate = editing.sourceDate
      const records = type === 'entry' ? [...next.entries, ...Timefolio.recurringEntries(next, sourceDate ?? date.value)] : next.categories
      if (id && !records.some(row => row.id === id))
        throw new Error('다른 탭에서 이미 삭제한 항목입니다.')
      if (type === 'entry') Timefolio.setEntry(next, input, id)
      else Timefolio.setCategory(next, input, id)
    })
    editor.close()
    notify('notice', '저장했습니다.')
  } catch (error) { notify('edit-error', error.message) }
})
$('delete-form').addEventListener('submit', event => {
  event.preventDefault()
  try {
    commit(next => {
      if (deleting.type === 'bulk') Timefolio.deleteEntries(next, deleting.ids)
      else if (deleting.type === 'entry') Timefolio.deleteEntries(next, new Set([deleting.id]))
      else if (deleting.type === 'rule') Timefolio.stopRecurring(next, deleting.id, deleting.date)
      else {
        if (next.entries.some(row => row.categoryId === deleting.id) ||
            (next.recurring ?? []).some(rule => rule.templates.some(step => step.categoryId === deleting.id))) throw new Error('이 카테고리를 사용하는 활동이 있습니다.')
        next.categories = next.categories.filter(row => row.id !== deleting.id)
      }
    })
    if (deleting.type === 'bulk') { clearSelection(); render() }
    else if (deleting.type === 'entry' && selectedEntries.delete(deleting.id)) render()
    $('confirm').close()
    notify('notice', deleting.type === 'rule' ? '반복을 중단했습니다.' : '삭제했습니다.')
  } catch (error) { notify('confirm-error', error.message) }
})
for (const control of document.querySelectorAll('[data-close]')) control.onclick = () => $(control.dataset.close).close()
$('close-editor').onclick = () => editor.close()
$('add').onclick = () => openEditor('category')
$('register-actual').onclick = () => openEditor('entry')
$('register-plan').onclick = () => openEditor('entry', { kind: 'planned' })

const repeatSteps = $('repeat-steps')
function numberSteps() {
  const rows = [...repeatSteps.children]
  rows.forEach((row, index) => {
    row.querySelector('legend').textContent = (index + 1) + '번째 활동'
    row.querySelector('[data-remove-step]').disabled = rows.length === 1
  })
}
function addRepeatStep(length) {
  const row = $('repeat-step').content.firstElementChild.cloneNode(true)
  const category = row.querySelector('select')
  for (const item of state.categories) {
    const option = element('option', item.name)
    option.value = item.id
    category.append(option)
  }
  row.querySelector('[name="length"]').value = length
  row.querySelector('[data-remove-step]').onclick = () => { row.remove(); numberSteps() }
  repeatSteps.append(row)
  numberSteps()
  return row
}
const repeatForm = $('repeat-form')
function updateRepeatFields() {
  const { frequency, until, monthDay, kind, indefinite, skipHolidays } = repeatForm.elements
  const oneDay = frequency.value === 'once'
  const weekly = frequency.value === 'weekly'
  const monthly = frequency.value === 'monthly'
  $('repeat-options').hidden = indefinite.disabled = skipHolidays.disabled = oneDay
  $('repeat-holiday-note').hidden = oneDay || !skipHolidays.checked
  $('repeat-until').hidden = until.disabled = oneDay || indefinite.checked
  $('repeat-weekdays').hidden = $('repeat-weekdays').disabled = !weekly
  $('repeat-month').hidden = monthDay.disabled = !monthly
  $('repeat-kind').hidden = kind.disabled = !oneDay
  $('repeat-schedule-note').hidden = oneDay
}
for (const name of ['frequency', 'indefinite', 'skipHolidays']) repeatForm.elements[name].onchange = updateRepeatFields
$('register-repeat').onclick = () => {
  repeatForm.reset()
  const selected = date.value
  const defaultEnd = Timefolio.shiftDate(selected, 30)
  repeatForm.elements.until.min = selected
  repeatForm.elements.until.value = Timefolio.validDate(defaultEnd) ? defaultEnd : '9998-12-31'
  repeatForm.elements.monthDay.value = Number(selected.slice(-2))
  updateRepeatFields()
  repeatSteps.replaceChildren()
  addRepeatStep(50)
  addRepeatStep(10)
  $('repeat-date').textContent = '시작 날짜 · ' + selected
  notify('repeat-error')
  $('repeat').showModal()
}
$('repeat-add-step').onclick = () => addRepeatStep(10).querySelector('input').focus()
repeatForm.onsubmit = event => {
  event.preventDefault()
  const form = event.currentTarget
  const steps = [...repeatSteps.children].map(row => ({
    title: row.querySelector('[name="title"]').value,
    categoryId: row.querySelector('[name="categoryId"]').value,
    length: row.querySelector('[name="length"]').valueAsNumber,
  }))
  try {
    const { frequency, until, start, end, kind, monthDay, indefinite, skipHolidays } = form.elements
    const options = {
      start: start.value, end: end.value, kind: kind.value, steps, frequency: frequency.value,
      weekdays: new FormData(form).getAll('weekday').map(Number), monthDay: monthDay.valueAsNumber,
      skipHolidays: skipHolidays.checked,
    }
    const once = frequency.value === 'once'
    if (!once && indefinite.checked) {
      commit(next => Timefolio.addRecurring(next, date.value, options))
      $('repeat').close()
      notify('notice', '무기한 반복을 저장했습니다.')
      return
    }
    const { created, skipped, matched } = commit(next => once
      ? Timefolio.repeatEntries(next, date.value, options)
      : Timefolio.repeatSchedule(next, date.value, until.value, options))
    $('repeat').close()
    const result = once ? created + '개 활동을 저장했습니다.' : matched + '일에 계획 ' + created + '개를 저장했습니다.'
    notify('notice', result + (skipped ? ' 이미 있는 활동 ' + skipped + '개를 건너뛰었습니다.' : ''))
  } catch (error) { notify('repeat-error', error.message) }
}
$('copy').onclick = () => {
  try {
    const count = commit(next => Timefolio.copyPrevious(next, date.value))
    notify('notice', count ? count + '개 활동을 계획으로 복사했습니다.' : '복사할 새 활동이 없습니다.')
  } catch (error) { notify('error', error.message) }
}
function selectPage(target, updateUrl = true) {
  if (page !== target) {
    page = target
    clearSelection()
    notify('notice')
    render()
    $('page-title').focus()
  }
  if (updateUrl && pageFromHash() !== target) location.hash = '#' + target
}
document.addEventListener('click', event => {
  const control = event.target.closest('[data-page], [data-go]')
  if (!control) return
  const target = control.dataset.page ?? control.dataset.go
  if (page === 'home' && ['day', 'register', 'saved'].includes(target)) showDate(Timefolio.today())
  selectPage(target)
})
window.addEventListener('hashchange', () => selectPage(pageFromHash(), false))
for (const control of document.querySelectorAll('[data-filter]')) control.onclick = () => {
  filter = control.dataset.filter
  clearSelection()
  for (const item of document.querySelectorAll('[data-filter]')) item.setAttribute('aria-pressed', item === control)
  render()
}
$('select-mode').onclick = () => {
  if (selecting) clearSelection()
  else selecting = true
  render()
}
const currentRows = () => Timefolio.day(state, date.value).rows
$('select-visible').onclick = () => {
  for (const row of currentRows()) if (filter === 'all' || row.kind === filter) selectedEntries.add(row.id)
  render()
}
$('delete-selected').onclick = () => confirmBulk(currentRows().filter(row => selectedEntries.has(row.id)), false)
$('delete-day').onclick = () => confirmBulk(currentRows(), true)
for (const control of document.querySelectorAll('[data-statistics]')) control.onclick = () => {
  statisticsKind = control.dataset.statistics
  for (const item of document.querySelectorAll('[data-statistics]')) item.setAttribute('aria-pressed', item === control)
  render()
}
$('period-prev').onclick = () => showDate(periodKind() === 'week' ? Timefolio.shiftDate(date.value, -7) : monthShift(date.value, -1))
$('period-next').onclick = () => showDate(periodKind() === 'week' ? Timefolio.shiftDate(date.value, 7) : monthShift(date.value, 1))
$('period-current').onclick = () => showDate(Timefolio.today())
$('saving-edit').onclick = () => {
  const saved = Timefolio.saving(state, date.value)
  const form = $('saving-form')
  form.elements.minutes.value = saved.minutes
  form.elements.note.value = saved.note
  notify('saving-error')
  $('saving-dialog').showModal()
}
$('saving-form').onsubmit = event => {
  event.preventDefault()
  const form = event.currentTarget
  try {
    commit(next => Timefolio.setSaving(next, date.value, form.elements.minutes.valueAsNumber, form.elements.note.value))
    $('saving-dialog').close()
    notify('notice', '아낀 시간 기록을 저장했습니다.')
  } catch (error) { notify('saving-error', error.message) }
}
function showDate(value) {
  if (!Timefolio.validDate(value)) return
  date.value = value
  lastDate = value
  clearSelection()
  notify('notice')
  render()
}
date.value = Timefolio.today()
let lastDate = date.value
date.addEventListener('change', () => {
  if (!Timefolio.validDate(date.value)) date.value = lastDate
  showDate(date.value)
})
for (const [id, pick] of [
  ['prev', () => Timefolio.shiftDate(date.value, -1)],
  ['next', () => Timefolio.shiftDate(date.value, 1)],
  ['today', Timefolio.today],
]) $(id).onclick = () => { const value = pick(); showDate(value); lastDate = date.value }
date.addEventListener('change', () => { lastDate = date.value })
window.addEventListener('storage', event => { if (event.key === Timefolio.key || event.key === null) load() })
buildClocks()
load()
