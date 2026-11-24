let csrf: { header: string; token: string } | undefined

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (method !== 'GET') {
    csrf ??= await api<typeof csrf>('/auth/csrf')
    if (csrf) headers[csrf.header] = csrf.token
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch('/api' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  if (!response.ok) {
    if (response.status === 403) csrf = undefined
    const error = await response.json().catch(() => ({}))
    throw new ApiError(error.message ?? '서버에 연결할 수 없습니다.', response.status)
  }
  if (path === '/auth/login' || path === '/auth/logout') csrf = undefined
  if (response.status === 204 || response.status === 201 && !response.headers.get('Content-Type')) return undefined as T
  return response.json()
}

export const message = (error: unknown) => error instanceof ApiError ? error.message : '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
export const seoulToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
