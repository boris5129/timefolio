const Timefolio = (() => {
  const key = 'timefolio.ledger.v1'
  const dayMinutes = 1440
  const datePattern = /^\d{4}-\d{2}-\d{2}$/
  const timePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
  const icons = ['●', '☾', '▤', '◆', '★', '✿', '♫']
  // Korean public holidays and substitute holidays published for these years.
  const holidays = {
    '2026': new Set('01-01 02-16 02-17 02-18 03-01 03-02 05-01 05-05 05-24 05-25 06-03 06-06 07-17 08-15 08-17 09-24 09-25 09-26 10-03 10-05 10-09 12-25'.split(' ')),
    '2027': new Set('01-01 02-06 02-07 02-08 02-09 03-01 05-01 05-03 05-05 05-13 06-06 07-17 07-19 08-15 08-16 09-14 09-15 09-16 10-03 10-04 10-09 10-11 12-25 12-27'.split(' ')),
  }
  const holidayKnown = date => Object.hasOwn(holidays, date.slice(0, 4))
  const isHoliday = date => holidays[date.slice(0, 4)]?.has(date.slice(5)) ?? false
  const names = ['수면','업무','학업','이동','식사','운동','취미','게임','영상 시청','자기계발','인간관계','휴식','기타']
  const colors = ['#6553d9','#365ecb','#147968','#47728d','#a95b23','#427d38','#983da2']
  const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
  const initial = () => ({
    version: 1,
    categories: names.map((name, i) => ({ id: 'default-' + i, name, color: colors[i % colors.length], icon: icons[(i + 1) % icons.length] })),
    entries: [],
  })
  function read(storage) {
    const raw = storage.getItem(key)
    if (raw === null) return initial()
    const state = JSON.parse(raw)
    if (state?.version !== 1 || !Array.isArray(state.categories) || !Array.isArray(state.entries))
      throw new Error('저장된 기록의 형식을 읽을 수 없습니다.')
    return state
  }
  function save(storage, state) {
    storage.setItem(key, JSON.stringify(state))
  }
  function minutes(stamp) {
    if (!timePattern.test(stamp)) return NaN
    const date = new Date(stamp + ':00Z')
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 16) !== stamp) return NaN
    return date.getTime() / 60000
  }
  function validDate(date) {
    return datePattern.test(date) && date >= '1901-01-01' && date <= '9998-12-31' && Number.isFinite(minutes(date + 'T00:00'))
  }
  function shiftDate(date, days) {
    return new Date((minutes(date + 'T00:00') + days * dayMinutes) * 60000).toISOString().slice(0, 10)
  }
  function union(intervals) {
    let total = 0
    let end = 0
    for (const [start, stop] of intervals.toSorted((a, b) => a[0] - b[0])) {
      total += Math.max(0, stop - Math.max(start, end))
      end = Math.max(stop, end)
    }
    return total
  }
  function day(state, date) {
    const midnight = minutes(date + 'T00:00')
    const rows = [...state.entries, ...recurringEntries(state, date)].map(entry => ({
      ...entry,
      first: Math.max(0, minutes(entry.start) - midnight),
      last: Math.min(dayMinutes, minutes(entry.end) - midnight),
    })).filter(row => row.last > row.first).sort((a, b) => a.first - b.first || a.last - b.last)
    const intervals = list => list.map(row => [row.first, row.last])
    const actual = union(intervals(rows.filter(row => row.kind === 'actual')))
    const planned = union(intervals(rows.filter(row => row.kind === 'planned')))
    return { rows, actual, planned, unrecorded: dayMinutes - actual, available: dayMinutes - union(intervals(rows)) }
  }
  const identity = ({ title, categoryId, start, end, kind }) => JSON.stringify([title, categoryId, start, end, kind])
  function validateEntry(state, input) {
    const title = input.title.trim()
    const memo = input.memo.trim()
    if (!title || title.length > 100 || memo.length > 500) throw new Error('활동 이름과 메모의 길이를 확인해 주세요.')
    if (!state.categories.some(category => category.id === input.categoryId)) throw new Error('카테고리를 선택해 주세요.')
    if (!['actual', 'planned'].includes(input.kind)) throw new Error('기록 종류를 선택해 주세요.')
    const { start, end, kind, categoryId } = input
    if (!validDate(start.slice(0, 10)) || !validDate(end.slice(0, 10)) || !(minutes(end) > minutes(start)))
      throw new Error('종료 시각은 시작 시각보다 늦어야 합니다.')
    return { title, memo, start, end, kind, categoryId }
  }
  function setEntry(state, input, id) {
    const entry = { ...validateEntry(state, input), id: id ?? crypto.randomUUID() }
    if ([...state.entries, ...recurringEntries(state, entry.start.slice(0, 10))].some(row => row.id !== id && identity(row) === identity(entry))) throw new Error('같은 활동이 이미 기록되어 있습니다.')
    if (id?.startsWith('repeat:')) deleteEntries(state, new Set([id]))
    state.entries = state.entries.filter(row => row.id !== id).concat(entry)
  }
  function categoryUsage(state, summary) {
    const grouped = new Map()
    for (const row of summary.rows) {
      if (!grouped.has(row.categoryId)) grouped.set(row.categoryId, { actual: [], planned: [] })
      grouped.get(row.categoryId)[row.kind].push([row.first, row.last])
    }
    return state.categories.map(category => {
      const intervals = grouped.get(category.id)
      const actual = union(intervals?.actual ?? [])
      const planned = union(intervals?.planned ?? [])
      return { category, actual, planned, target: category.budgetMinutes ?? planned }
    }).filter(row => row.category.budgetMinutes != null || row.actual > 0 || row.planned > 0)
  }
  function setCategory(state, input, id) {
    const name = input.name.trim()
    if (!name || name.length > 40 || !/^#[a-f\d]{6}$/i.test(input.color) || !icons.includes(input.icon))
      throw new Error('카테고리 이름, 색상, 아이콘을 확인해 주세요.')
    if (state.categories.some(item => item.id !== id && item.name.toLowerCase() === name.toLowerCase()))
      throw new Error('같은 이름의 카테고리가 이미 있습니다.')
    const budgetMinutes = input.budgetMinutes == null || input.budgetMinutes === '' ? null : Number(input.budgetMinutes)
    if (budgetMinutes !== null && (!Number.isInteger(budgetMinutes) || budgetMinutes < 1 || budgetMinutes > dayMinutes))
      throw new Error('하루 목표는 1~1440분 사이의 정수로 입력해 주세요.')
    const category = { id: id ?? crypto.randomUUID(), name, color: input.color, icon: input.icon, budgetMinutes }
    state.categories = id ? state.categories.map(item => item.id === id ? category : item) : [...state.categories, category]
  }
  function copyPrevious(state, date) {
    const previous = shiftDate(date, -1)
    const planned = new Set([...state.entries, ...recurringEntries(state, date)].map(identity))
    let count = 0
    for (const entry of [...state.entries, ...recurringEntries(state, previous)].filter(row => row.start.slice(0, 10) === previous)) {
      const next = stamp => shiftDate(stamp.slice(0, 10), 1) + stamp.slice(10)
      const record = { ...entry, start: next(entry.start), end: next(entry.end), kind: 'planned' }
      if (!validDate(record.end.slice(0, 10)) || planned.has(identity(record))) continue
      record.id = crypto.randomUUID()
      state.entries.push(record)
      planned.add(identity(record))
      count++
    }
    return count
  }
  function repeatTemplates(state, { start, end, kind, steps }) {
    const from = minutes('2000-01-01T' + start)
    const to = minutes('2000-01-01T' + end)
    if (!(to > from)) throw new Error('같은 날의 종료 시각을 시작 시각보다 늦게 입력해 주세요.')
    if (!steps.length || steps.some(step => !Number.isInteger(step.length) || step.length < 1 || step.length > dayMinutes))
      throw new Error('활동 길이는 1~1440분 사이의 정수로 입력해 주세요.')
    return steps.map(step => ({
      ...validateEntry(state, { ...step, start: '2000-01-01T' + start, end: '2000-01-01T' + end, kind, memo: '' }),
      length: step.length,
    }))
  }
  function* repeatSlots(date, start, end, templates) {
    const stamp = minute => new Date(minute * 60000).toISOString().slice(0, 16)
    let at = minutes(date + 'T' + start)
    const stop = minutes(date + 'T' + end)
    let index = 0
    while (at < stop) {
      const { length, ...template } = templates[index]
      const next = Math.min(at + length, stop)
      yield { ...template, start: stamp(at), end: stamp(next) }
      at = next
      index = (index + 1) % templates.length
    }
  }
  function repeatOnDates(state, dates, options) {
    const templates = repeatTemplates(state, options)
    const existing = new Set(state.entries.map(identity))
    const additions = []
    let skipped = 0
    let matched = 0
    for (const date of dates) {
      if (!validDate(date)) throw new Error('반복할 날짜를 확인해 주세요.')
      matched++
      for (const row of recurringEntries(state, date)) existing.add(identity(row))
      for (const record of repeatSlots(date, options.start, options.end, templates)) {
        if (additions.length + skipped >= 10000) throw new Error('한 번에 10,000개까지 처리할 수 있습니다. 종료 날짜를 앞당겨 주세요.')
        const key = identity(record)
        if (existing.has(key)) skipped++
        else {
          additions.push({ ...record, id: crypto.randomUUID() })
          existing.add(key)
        }
      }
    }
    if (!matched) throw new Error('선택한 기간에 반복 조건과 맞는 날짜가 없습니다.')
    state.entries = state.entries.concat(additions)
    return { created: additions.length, skipped, matched }
  }
  function repeatEntries(state, date, options) {
    const { created, skipped } = repeatOnDates(state, [date], options)
    return { created, skipped }
  }
  function* scheduledDates(start, end, options) {
    if (!validDate(start) || !validDate(end) || end < start)
      throw new Error('종료 날짜는 시작 날짜와 같거나 이후여야 합니다.')
    validateFrequency(options)
    const { frequency, monthDay } = options
    if (frequency === 'monthly') {
      const month = new Date(start.slice(0, 7) + '-01T00:00:00Z')
      while (month.toISOString().slice(0, 7) <= end.slice(0, 7)) {
        const date = month.toISOString().slice(0, 7) + '-' + String(monthDay).padStart(2, '0')
        if (date >= start && date <= end && validDate(date) && matchesDate(date, options)) yield date
        month.setUTCMonth(month.getUTCMonth() + 1)
      }
      return
    }
    for (let date = start; date <= end; date = shiftDate(date, 1)) if (matchesDate(date, options)) yield date
  }
  function validateFrequency({ frequency, weekdays, monthDay }) {
    const modes = ['daily', 'weekdays', 'weekly', 'monthly']
    if (!modes.includes(frequency)) throw new Error('반복 주기를 선택해 주세요.')
    if (frequency === 'weekly' && (!weekdays.length || weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6)))
      throw new Error('반복할 요일을 하나 이상 선택해 주세요.')
    if (frequency === 'monthly' && (!Number.isInteger(monthDay) || monthDay < 1 || monthDay > 31))
      throw new Error('매월 반복할 날짜는 1~31 사이로 입력해 주세요.')
  }
  function matchesDate(date, { frequency, weekdays, monthDay, skipHolidays }) {
    if (skipHolidays && isHoliday(date)) return false
    if (frequency === 'monthly') return Number(date.slice(-2)) === monthDay
    const weekday = new Date(date + 'T00:00:00Z').getUTCDay()
    return frequency === 'daily' || frequency === 'weekdays' && weekday >= 1 && weekday <= 5 ||
      frequency === 'weekly' && weekdays.includes(weekday)
  }
  function addRecurring(state, startDate, options) {
    if (!validDate(startDate)) throw new Error('시작 날짜를 확인해 주세요.')
    validateFrequency(options)
    const { start, end, frequency, monthDay, skipHolidays } = options
    const weekdays = frequency === 'weekly' ? [...new Set(options.weekdays)].sort() : []
    const templates = repeatTemplates(state, { ...options, kind: 'planned' })
    const settings = { startDate, start, end, frequency, weekdays,
      monthDay: frequency === 'monthly' ? monthDay : null, skipHolidays: Boolean(skipHolidays), templates }
    state.recurring ??= []
    if (state.recurring.some(rule => !rule.stopDate && Object.keys(settings).every(key => JSON.stringify(rule[key]) === JSON.stringify(settings[key]))))
      throw new Error('같은 무기한 반복 일정이 이미 있습니다.')
    state.recurring.push({ ...settings, id: crypto.randomUUID(), stopDate: null })
  }
  function recurringEntries(state, date, includeDuplicates = false) {
    if (!validDate(date) || !state.recurring?.length) return []
    const stored = new Set(state.entries.filter(row => row.start.startsWith(date)).map(identity))
    const output = []
    for (const rule of state.recurring) {
      if (date < rule.startDate || (rule.stopDate && date >= rule.stopDate) || !matchesDate(date, rule)) continue
      let index = 0
      for (const record of repeatSlots(date, rule.start, rule.end, rule.templates)) {
        const id = 'repeat:' + rule.id + ':' + date + ':' + index++
        const key = identity(record)
        if (state.repeatExceptions?.[id] || (!includeDuplicates && stored.has(key))) continue
        stored.add(key)
        output.push({ ...record, id })
      }
    }
    return output
  }
  function excludeOccurrence(state, id) {
    state.repeatExceptions ??= {}
    state.repeatExceptions[id] = true
  }
  function deleteEntries(state, ids) {
    if (state.recurring?.length) {
      const records = state.entries.filter(row => ids.has(row.id))
      const dates = new Set(records.map(row => row.start.slice(0, 10)))
      for (const id of ids) if (id.startsWith('repeat:')) dates.add(id.split(':')[2])
      for (const date of dates) {
        const occurrences = recurringEntries(state, date, true)
        const removed = new Set([...records, ...occurrences.filter(row => ids.has(row.id))].map(identity))
        for (const row of occurrences) if (removed.has(identity(row))) excludeOccurrence(state, row.id)
      }
    }
    state.entries = state.entries.filter(row => !ids.has(row.id))
  }
  function stopRecurring(state, id, date) {
    const rule = state.recurring?.find(item => item.id === id)
    if (!rule || !validDate(date) || (rule.stopDate && rule.stopDate <= date))
      throw new Error('중단할 날짜와 반복 일정을 확인해 주세요.')
    if (date <= rule.startDate) {
      state.recurring = state.recurring.filter(item => item.id !== id)
      return
    }
    rule.stopDate = date
  }
  function repeatSchedule(state, startDate, endDate, options) {
    return repeatOnDates(state, scheduledDates(startDate, endDate, options), { ...options, kind: 'planned' })
  }
  function saving(state, date) {
    return state.savings?.[date] ?? { minutes: 0, note: '' }
  }
  function setSaving(state, date, minutes, note) {
    if (!validDate(date) || !Number.isInteger(minutes) || minutes < 0 || minutes > dayMinutes || note.length > 300)
      throw new Error('아낀 시간은 0~1440분 사이의 정수로, 메모는 300자 이내로 입력해 주세요.')
    state.savings ??= {}
    if (minutes === 0) delete state.savings[date]
    else state.savings[date] = { minutes, note: note.trim() }
  }
  const activityKey = row => JSON.stringify([row.categoryId, row.title.trim().toLowerCase()])
  const intervalsOf = rows => rows.map(row => [row.first, row.last])
  function intersection(a, b) {
    const from = Math.max(a.first, b.first)
    const to = Math.min(a.last, b.last)
    return from < to ? [from, to] : null
  }
  function overlapSaving(state, date, summary = day(state, date)) {
    const activities = summary.rows.filter(row => row.kind === 'actual')
    const overlap = []
    const byActivity = new Map()
    for (const [index, left] of activities.entries()) {
      for (let j = index + 1; j < activities.length && activities[j].first < left.last; j++) {
        const right = activities[j]
        const keys = [activityKey(left), activityKey(right)]
        if (keys[0] === keys[1]) continue
        const interval = intersection(left, right)
        if (!interval) continue
        overlap.push(interval)
        for (const key of keys) {
          if (!byActivity.has(key)) byActivity.set(key, [])
          byActivity.get(key).push(interval)
        }
      }
    }
    if (!overlap.length) return { overlap: 0, candidates: [], confirmed: 0 }
    const candidates = summary.rows.filter(row => row.kind === 'planned').map(plan => {
      const key = activityKey(plan)
      const concurrent = byActivity.get(key) ?? []
      const outsidePlan = concurrent.flatMap(([from, to]) => [
        [from, Math.min(to, plan.first)], [Math.max(from, plan.last), to],
      ]).filter(([from, to]) => to > from)
      const moved = union(outsidePlan)
      const actual = union(intervalsOf(activities.filter(row => activityKey(row) === key)))
      return { id: plan.id, title: plan.title, first: plan.first, last: plan.last,
        minutes: Math.max(0, Math.min(moved, plan.last - plan.first - (actual - moved))) }
    }).filter(candidate => candidate.minutes > 0)
    const chosen = candidates.find(row => row.id === state.overlapConfirmations?.[date])
    return { overlap: union(overlap), candidates, confirmed: chosen?.minutes ?? 0, chosen }
  }
  function setOverlapConfirmation(state, date, id) {
    if (!validDate(date) || (id && !overlapSaving(state, date).candidates.some(row => row.id === id)))
      throw new Error('대체할 계획을 다시 확인해 주세요.')
    state.overlapConfirmations ??= {}
    if (id) state.overlapConfirmations[date] = id
    else delete state.overlapConfirmations[date]
  }
  function dayReview(state, summary) {
    const actual = summary.rows.filter(row => row.kind === 'actual')
    const planned = summary.rows.filter(row => row.kind === 'planned')
    const matches = planned.flatMap(plan => actual.filter(row => activityKey(row) === activityKey(plan))
      .map(row => intersection(plan, row)).filter(Boolean))
    const matched = union(matches)
    const restIds = new Set(['default-0', 'default-11'])
    const leisureIds = new Set(['default-6', 'default-7', 'default-8'])
    const tracked = categoryUsage(state, summary)
    return {
      matched,
      percentage: summary.planned ? Math.floor(matched / summary.planned * 100) : null,
      rest: tracked.filter(row => restIds.has(row.category.id) || /^(휴식|수면)$/.test(row.category.name)),
      leisure: tracked.filter(row => leisureIds.has(row.category.id) || /^(취미|게임|영상 시청|여가)$/.test(row.category.name)),
    }
  }
  function period(state, date, kind) {
    const anchor = new Date(date + 'T00:00:00Z')
    const month = date.slice(0, 7)
    const monthStart = month + '-01'
    const offset = (new Date(monthStart + 'T00:00:00Z').getUTCDay() + 6) % 7
    const weekStart = shiftDate(date, -(anchor.getUTCDay() + 6) % 7)
    const length = kind === 'week' ? 7 : new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)).getUTCDate()
    const start = kind === 'week' ? weekStart : monthStart
    const days = Array.from({ length }, (_, i) => {
      const key = shiftDate(start, i)
      const summary = day(state, key)
      const { actual, planned, rows } = summary
      const stacked = state.overlapConfirmations?.[key] ? overlapSaving(state, key, summary).confirmed : 0
      return { date: key, actual, planned, count: rows.length, saved: saving(state, key).minutes, stacked }
    })
    const totals = days.reduce((total, row) => ({
      actual: total.actual + row.actual,
      planned: total.planned + row.planned,
      saved: total.saved + row.saved,
      stacked: total.stacked + row.stacked,
    }), { actual: 0, planned: 0, saved: 0, stacked: 0 })
    return { days, totals, offset: kind === 'week' ? 0 : offset }
  }
  return { key, read, save, today, validDate, shiftDate, day, setEntry, setCategory, categoryUsage, copyPrevious, repeatEntries, repeatSchedule, addRecurring, stopRecurring, deleteEntries, recurringEntries, holidayKnown, isHoliday, overlapSaving, setOverlapConfirmation, dayReview, minutes, period, saving, setSaving }
})()
if (typeof module !== 'undefined') module.exports = Timefolio
