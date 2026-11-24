import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Summary } from './App'

afterEach(cleanup)
describe('하루 요약', () => {
  it('서버가 계산한 실제와 예정 시간을 각각 표시한다', () => {
    render(<Summary day={{ date: '2026-11-24', actual: 90, planned: 30, available: 1320, unrecorded: 1350, primary: 90, secondary: 0, total: 1440, entries: [] }}/>)
    expect(within(screen.getByRole('region', { name: '하루 시간 요약' })).getByText('1시간 30분')).toBeTruthy()
    expect(screen.getByText('30분')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('90')
  })
})
