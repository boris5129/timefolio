import { test, expect, type APIRequestContext, type Page } from '../../frontend/node_modules/@playwright/test/index.mjs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const password = 'timefolio-test-2026'
const email = () => 'test-' + crypto.randomUUID() + '@example.test'
async function write(request: APIRequestContext, path: string, method: string, data?: unknown) {
  const response = await request.get('/api/auth/csrf')
  const { header, token } = await response.json()
  return request.fetch('/api' + path, { method, headers: { [header]: token }, data })
}
async function account(request: APIRequestContext) {
  const credentials = { email: email(), password }
  expect((await write(request, '/auth/register', 'POST', credentials)).status()).toBe(201)
  expect((await write(request, '/auth/login', 'POST', credentials)).status()).toBe(200)
  return credentials
}
async function login(page: Page, userEmail: string) {
  await page.getByLabel('이메일').fill(userEmail)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()
}

test('PC 가입, 기록 등록·수정·삭제, 새로고침과 서버 재시작 후 유지', async ({ page }) => {
  test.setTimeout(100_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', entry => {
    if (entry.type() === 'error' && !entry.text().includes('401')) errors.push(entry.text())
  })
  const userEmail = email()
  await page.goto('/')
  await page.getByRole('button', { name: '회원가입' }).click()
  await page.getByLabel('이메일').fill(userEmail)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '가입하기' }).click()
  await expect(page.getByText('가입했습니다. 로그인해 주세요.')).toBeVisible()
  await login(page, userEmail)
  await expect(page.getByText('아직 기록된 활동이 없어요')).toBeVisible()
  await page.getByRole('button', { name: '활동 추가' }).click()
  await page.getByLabel('활동 이름').fill('저녁 독서')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('저녁 독서', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '저녁 독서 수정' }).click()
  await page.getByLabel('활동 이름').fill('아침 독서')
  await page.getByRole('button', { name: '저장' }).click()
  await page.reload()
  await expect(page.getByText('아침 독서', { exact: true })).toBeVisible()
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve('../scripts/restart-test-app.ps1')], { timeout: 75000 })
  await page.reload()
  await login(page, userEmail)
  await expect(page.getByText('아침 독서', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '아침 독서 삭제' }).click()
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByText('아직 기록된 활동이 없어요')).toBeVisible()
  await page.getByRole('button', { name: '로그아웃' }).click()
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
  expect(errors).toEqual([])
})

test('REST 유효성, 자정 통계, 계획 복사, 중복 및 사용자 격리', async ({ request, playwright }) => {
  expect((await request.get('/api/categories')).status()).toBe(401)
  expect((await request.post('/api/auth/register', { data: { email: email(), password } })).status()).toBe(403)
  await account(request)
  const category = { name: '독서', color: '#4f46e5', icon: 'book' }
  const catResponse = await write(request, '/categories', 'POST', category)
  expect(catResponse.status()).toBe(201)
  const { id: categoryId } = await catResponse.json()
  expect((await write(request, '/categories/' + categoryId, 'PUT', { ...category, name: '책 읽기' })).status()).toBe(200)
  const entry = { title: '독서', categoryId, start: '2026-11-24T23:30', end: '2026-11-25T00:30', kind: 'ACTUAL', memo: '' }
  expect((await write(request, '/entries', 'POST', { ...entry, end: '2026-11-24T22:00' })).status()).toBe(400)
  const created = await write(request, '/entries', 'POST', entry)
  expect(created.status()).toBe(201)
  const { id } = await created.json()
  expect((await write(request, '/entries', 'POST', entry)).status()).toBe(409)
  expect((await write(request, '/categories/' + categoryId, 'DELETE')).status()).toBe(409)
  for (const date of ['2026-11-24', '2026-11-25']) {
    expect(await (await request.get('/api/entries?date=' + date)).json()).toMatchObject({ actual: 30, unrecorded: 1410 })
  }
  expect(await (await request.get('/api/entries/recent')).json()).toContainEqual({ title: '독서', categoryId })
  for (const expected of [1, 0]) {
    expect(await (await write(request, '/entries/copy', 'POST', { date: '2026-11-25' })).json()).toEqual({ created: expected })
  }
  expect(await (await request.get('/api/entries?date=2026-11-25')).json()).toMatchObject({ actual: 30, planned: 30, available: 1380 })
  const other = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:18080' })
  try {
    await account(other)
    expect(await (await other.get('/api/entries?date=2026-11-25')).json()).toMatchObject({ actual: 0, entries: [] })
    expect((await write(other, '/entries/' + id, 'DELETE')).status()).toBe(404)
    expect((await write(other, '/entries', 'POST', entry)).status()).toBe(404)
  } finally { await other.dispose() }
})

test('모바일에서 내비게이션, 카테고리 추가·삭제 및 가로 넘침 확인', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const credentials = await account(page.request)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()
  await page.getByRole('button', { name: '카테고리 관리' }).click()
  await page.getByRole('button', { name: '카테고리 추가' }).click()
  await page.getByLabel('카테고리 이름').fill('산책')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('산책', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '산책 삭제' }).click()
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByText('산책', { exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: '시간 가계부' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await expect(page.getByTitle(credentials.email)).toBeVisible()
})
