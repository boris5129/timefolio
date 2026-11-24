const assert = require('node:assert/strict')
const { test } = require('node:test')
const ledger = require('../../web/ledger.js')

function setup() {
  const data = new Map()
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
  const state = ledger.read(storage)
  const entry = {
    title: '독서', categoryId: state.categories[0].id, start: '2026-11-24T23:30',
    end: '2026-11-25T00:30', kind: 'actual', memo: '',
  }
  return { storage, state, entry }
}

test('자정에 걸친 기록과 겹치는 기록은 날짜별 합집합으로 계산한다', () => {
  const { state, entry } = setup()
  ledger.setEntry(state, entry)
  ledger.setEntry(state, { ...entry, title: '추가 기록', start: '2026-11-25T00:15', end: '2026-11-25T01:00' })
  assert.equal(ledger.day(state, '2026-11-24').actual, 30)
  assert.equal(ledger.day(state, '2026-11-25').actual, 60)
})

test('실제와 계획은 따로 집계하고 가용량에서는 겹침을 한 번만 뺀다', () => {
  const { state, entry } = setup()
  ledger.setEntry(state, entry)
  ledger.setEntry(state, { ...entry, kind: 'planned' })
  const day = ledger.day(state, '2026-11-24')
  assert.equal(day.actual, 30)
  assert.equal(day.planned, 30)
  assert.equal(day.available, 1410)
  assert.equal(day.unrecorded, 1410)
})

test('잘못된 일자와 역전된 시각, 동일 기록을 거부한다', () => {
  const { state, entry } = setup()
  assert.equal(ledger.validDate('2026-02-29'), false)
  assert.equal(ledger.validDate('2028-02-29'), true)
  assert.throws(() => ledger.setEntry(state, { ...entry, end: entry.start }), /종료/)
  ledger.setEntry(state, entry)
  assert.throws(() => ledger.setEntry(state, entry), /이미/)
})

test('전날 복사는 자정을 넘는 계획을 만들고 같은 기록을 다시 만들지 않는다', () => {
  const { state, entry } = setup()
  ledger.setEntry(state, entry)
  assert.equal(ledger.copyPrevious(state, '2026-11-25'), 1)
  assert.equal(ledger.copyPrevious(state, '2026-11-25'), 0)
  assert.equal(ledger.day(state, '2026-11-26').planned, 30)
})

test('카테고리와 수정된 기록을 저장한 뒤 다시 읽을 수 있다', () => {
  const { storage, state, entry } = setup()
  ledger.setCategory(state, { name: '읽기', icon: '▤', color: '#444444' })
  assert.throws(() => ledger.setCategory(state, { name: '읽기', icon: '▤', color: '#444444' }), /이미/)
  const { id } = state.categories.at(-1)
  ledger.setEntry(state, { ...entry, categoryId: id })
  ledger.setEntry(state, { ...entry, title: '다시 읽기', categoryId: id }, state.entries[0].id)
  ledger.save(storage, state)
  assert.deepEqual(ledger.read(storage), state)
})

test('50분 수업과 10분 휴식을 13시까지 각 네 번 저장하고 중복을 건너뛴다', () => {
  const { state, entry } = setup()
  const steps = [
    { title: '수업', categoryId: entry.categoryId, length: 50 },
    { title: '쉬는 시간', categoryId: entry.categoryId, length: 10 },
  ]
  const options = { start: '09:00', end: '13:00', kind: 'planned', steps }
  assert.deepEqual(ledger.repeatEntries(state, '2026-11-24', options), { created: 8, skipped: 0 })
  assert.equal(state.entries.at(-1).end, '2026-11-24T13:00')
  assert.equal(ledger.day(state, '2026-11-24').planned, 240)
  assert.deepEqual(ledger.repeatEntries(state, '2026-11-24', options), { created: 0, skipped: 8 })
})

test('마지막 반복을 종료 시각에서 자르고 잘못된 묶음은 일부 저장하지 않는다', () => {
  const { state, entry } = setup()
  const first = { title: '수업', categoryId: entry.categoryId, length: 50 }
  const options = { start: '09:00', end: '09:55', kind: 'actual', steps: [first, { ...first, title: '휴식', length: 10 }] }
  assert.throws(() => ledger.repeatEntries(state, '2026-11-24', { ...options, steps: [first, { ...first, title: '' }] }))
  assert.equal(state.entries.length, 0)
  assert.deepEqual(ledger.repeatEntries(state, '2026-11-24', options), { created: 2, skipped: 0 })
  assert.equal(state.entries.at(-1).end, '2026-11-24T09:55')
})

test('주간은 월요일에 시작하고 월간은 윤년 달력과 아낀 시간을 반영한다', () => {
  const { state, entry } = setup()
  ledger.setEntry(state, { ...entry, start: '2028-02-28T23:30', end: '2028-02-29T00:30' })
  ledger.setSaving(state, '2028-02-29', 30, ' 이동 단축 ')
  const week = ledger.period(state, '2028-02-29', 'week')
  assert.equal(week.days[0].date, '2028-02-28')
  assert.equal(week.days.at(-1).date, '2028-03-05')
  assert.equal(week.totals.actual, 60)
  assert.equal(week.totals.saved, 30)
  const month = ledger.period(state, '2028-02-29', 'month')
  assert.equal(month.days.length, 29)
  assert.equal(month.offset, 1)
  assert.equal(month.totals.saved, 30)
  assert.deepEqual(ledger.saving(state, '2028-02-29'), { minutes: 30, note: '이동 단축' })
  assert.throws(() => ledger.setSaving(state, '2028-02-29', -1, ''))
  ledger.setSaving(state, '2028-02-29', 0, '')
  assert.equal(ledger.period(state, '2028-02-29', 'month').totals.saved, 0)
})

test('매일, 평일, 선택한 요일에 반복 계획을 날짜별로 저장한다', () => {
  for (const [frequency, days] of [
    ['daily', ['23','24','25','26','27','28','29']],
    ['weekdays', ['23','24','25','26','27']],
    ['weekly', ['23','25','27']],
  ]) {
    const { state, entry } = setup()
    const options = { frequency, weekdays: [1,3,5], start: '09:00', end: '10:00',
      steps: [{ title: '수업', categoryId: entry.categoryId, length: 60 }] }
    assert.deepEqual(ledger.repeatSchedule(state, '2026-11-23', '2026-11-29', options),
      { matched: days.length, created: days.length, skipped: 0 })
    assert.deepEqual(state.entries.map(row => row.start), days.map(day => '2026-11-' + day + 'T09:00'))
    assert.ok(state.entries.every(row => row.kind === 'planned'))
    assert.deepEqual(ledger.repeatSchedule(state, '2026-11-23', '2026-11-29', options),
      { matched: days.length, created: 0, skipped: days.length })
  }
})

test('매월 반복은 존재하는 날짜만 저장하고 날짜가 없으면 기록을 바꾸지 않는다', () => {
  const { state, entry } = setup()
  const options = { frequency: 'monthly', monthDay: 31, start: '09:00', end: '10:00',
    steps: [{ title: '수업', categoryId: entry.categoryId, length: 60 }] }
  ledger.repeatSchedule(state, '2028-01-03', '2028-04-30', options)
  assert.deepEqual(state.entries.map(row => row.start), ['2028-01-31T09:00', '2028-03-31T09:00'])
  assert.throws(() => ledger.repeatSchedule(state, '2028-02-01', '2028-02-29', options), /맞는 날짜/)
  assert.throws(() => ledger.repeatSchedule(state, '2028-02-29', '2028-02-01', options), /시작 날짜/)
  assert.throws(() => ledger.repeatSchedule(state, '2028-02-01', '2028-02-29',
    { ...options, frequency: 'weekly', weekdays: [] }), /요일/)
  assert.equal(state.entries.length, 2)
  ledger.repeatSchedule(state, '2028-02-01', '2028-02-29', { ...options, monthDay: 29 })
  assert.equal(state.entries.at(-1).start, '2028-02-29T09:00')
})

test('공휴일 제외는 대체공휴일에 적용하고 공휴일 자료 연도를 표시할 수 있다', () => {
  const { state, entry } = setup()
  const options = { frequency: 'weekdays', skipHolidays: true, start: '09:00', end: '10:00',
    steps: [{ title: '수업', categoryId: entry.categoryId, length: 60 }] }
  assert.equal(ledger.repeatSchedule(state, '2027-02-08', '2027-02-10', options).created, 1)
  assert.equal(state.entries[0].start, '2027-02-10T09:00')
  assert.equal(ledger.holidayKnown('2027-02-09'), true)
  assert.equal(ledger.holidayKnown('2028-02-09'), false)
})

test('무기한 규칙은 조회일에만 적용하며 편집과 삭제, 중단을 유지한다', () => {
  const { state, entry, storage } = setup()
  const options = { frequency: 'daily', skipHolidays: true, start: '09:00', end: '10:00',
    steps: [{ title: '수업', categoryId: entry.categoryId, length: 60 }] }
  ledger.addRecurring(state, '2026-12-24', options)
  assert.throws(() => ledger.addRecurring(state, '2026-12-24', options), /이미/)
  assert.equal(state.entries.length, 0)
  assert.equal(ledger.day(state, '2026-12-25').planned, 0)
  assert.equal(ledger.day(state, '2030-01-01').planned, 60)
  const row = ledger.day(state, '2026-12-26').rows[0]
  ledger.setEntry(state, { ...row, title: '보강' }, row.id)
  assert.deepEqual(ledger.day(state, '2026-12-26').rows.map(entry => entry.title), ['보강'])
  ledger.deleteEntries(state, new Set([row.id]))
  ledger.save(storage, state)
  assert.equal(ledger.day(ledger.read(storage), '2026-12-26').planned, 0)
  assert.equal(ledger.day(state, '2026-12-27').planned, 60)
  ledger.stopRecurring(state, state.recurring[0].id, '2026-12-28')
  assert.equal(ledger.day(state, '2026-12-27').planned, 60)
  assert.equal(ledger.day(state, '2026-12-28').planned, 0)
})

test('카테고리 시간 예산은 같은 종류의 겹침을 한 번만 계산하고 설정 목표를 우선한다', () => {
  const { state, entry } = setup()
  ledger.setEntry(state, entry)
  ledger.setEntry(state, { ...entry, title: '겹친 활동' })
  ledger.setEntry(state, { ...entry, kind: 'planned', start: '2026-11-24T22:00', end: '2026-11-24T23:00' })
  const usage = () => ledger.categoryUsage(state, ledger.day(state, '2026-11-24'))
  assert.equal(usage().length, 1)
  assert.deepEqual([usage()[0].actual, usage()[0].planned, usage()[0].target], [30, 60, 60])
  const category = state.categories[0]
  ledger.setCategory(state, { ...category, budgetMinutes: '20' }, category.id)
  assert.equal(usage()[0].target, 20)
  assert.throws(() => ledger.setCategory(state, { ...category, budgetMinutes: '0' }, category.id), /목표/)
})

test('실제 중첩은 한 번만 세고 대체한 별도 계획을 확인한 양만 절약으로 인정한다', () => {
  const { state, entry } = setup()
  const date = '2026-11-23'
  const put = (title, start, end, kind, categoryId = entry.categoryId) =>
    ledger.setEntry(state, { ...entry, title, start: date + 'T' + start, end: date + 'T' + end, kind, categoryId })
  put('이동', '09:00', '10:00', 'actual')
  put('독서', '09:00', '09:45', 'actual')
  put('듣기', '09:15', '09:30', 'actual')
  put('독서', '13:00', '13:30', 'planned')
  put('독서', '13:00', '13:10', 'actual')
  const result = () => ledger.overlapSaving(state, date)
  assert.equal(result().overlap, 45)
  assert.equal(result().confirmed, 0)
  assert.equal(result().candidates[0].minutes, 20)
  ledger.setOverlapConfirmation(state, date, result().candidates[0].id)
  assert.equal(result().confirmed, 20)
  assert.equal(ledger.period(state, date, 'week').totals.stacked, 20)
  ledger.deleteEntries(state, new Set([state.entries.find(row => row.kind === 'planned').id]))
  assert.equal(result().confirmed, 0)
})

test('일과 평가의 이행 시간은 실제와 계획의 이름, 카테고리, 시각을 비교한다', () => {
  const { state, entry } = setup()
  const date = '2026-11-23'
  const rest = { ...entry, title: '쉬기', categoryId: 'default-11', start: date + 'T10:00', end: date + 'T11:00' }
  ledger.setEntry(state, { ...rest, kind: 'planned' })
  ledger.setEntry(state, { ...rest, end: date + 'T10:30' })
  ledger.setEntry(state, { ...rest, title: '다른 일', start: date + 'T10:30' })
  const review = ledger.dayReview(state, ledger.day(state, date))
  assert.equal(review.percentage, 50)
  assert.equal(review.matched, 30)
  assert.equal(review.rest[0].actual, 60)
  assert.equal(ledger.isHoliday('2026-12-25'), true)
  assert.equal(ledger.isHoliday('2026-12-26'), false)
})
