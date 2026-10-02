import { describe, expect, it } from 'vitest'
import { formatCompact, formatPercent, formatShortDate } from '@/lib/format'

describe('admin formatting helpers', () => {
  it('formats rates and shows a dash when there is nothing to divide by', () => {
    expect(formatPercent(0.4286)).toBe('43%')
    expect(formatPercent(1)).toBe('100%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(null)).toBe('—')
    expect(formatPercent(undefined)).toBe('—')
    expect(formatPercent(NaN)).toBe('—')
  })

  it('compacts large numbers for chart axes', () => {
    expect(formatCompact(0)).toBe('0')
    expect(formatCompact(12)).toBe('12')
    expect(formatCompact(1200)).toBe('1.2K')
  })

  it('shows UTC calendar days without shifting them across timezones', () => {
    expect(formatShortDate('2026-10-02')).toBe('Oct 2')
    expect(formatShortDate('2026-01-01')).toBe('Jan 1')
    expect(formatShortDate('not-a-date')).toBe('not-a-date')
  })
})
