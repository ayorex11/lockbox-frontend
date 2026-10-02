import { describe, expect, it } from 'vitest'
import { linePath, nearestIndex, niceMax, sum, xAt, yAt } from '@/lib/chart'

describe('niceMax', () => {
  it('always gives a whole-number axis divisible into four steps', () => {
    for (const v of [0, 1, 3, 4, 5, 9, 17, 48, 49, 100, 101, 999, 12345]) {
      const max = niceMax(v)
      expect(max).toBeGreaterThanOrEqual(v)
      expect(max % 4).toBe(0)
      expect(Number.isInteger(max / 4)).toBe(true)
    }
  })

  it('keeps small data on a readable minimum scale and does not overshoot much', () => {
    expect(niceMax(0)).toBe(4)
    expect(niceMax(3)).toBe(4)
    expect(niceMax(48)).toBe(48)
    expect(niceMax(49)).toBeLessThanOrEqual(60)
  })

  it('survives garbage input', () => {
    expect(niceMax(NaN)).toBe(4)
    expect(niceMax(-5)).toBe(4)
  })
})

describe('scales', () => {
  it('spreads points edge to edge and centres a lone point', () => {
    expect(xAt(0, 5, 40, 400)).toBe(40)
    expect(xAt(4, 5, 40, 400)).toBe(440)
    expect(xAt(2, 5, 40, 400)).toBe(240)
    expect(xAt(0, 1, 40, 400)).toBe(240)
  })

  it('puts zero at the bottom and max at the top, clamping out-of-range values', () => {
    expect(yAt(0, 10, 12, 180)).toBe(192)
    expect(yAt(10, 10, 12, 180)).toBe(12)
    expect(yAt(99, 10, 12, 180)).toBe(12)
    expect(yAt(-4, 10, 12, 180)).toBe(192)
    expect(yAt(5, 0, 12, 180)).toBe(192)
  })

  it('builds a path with one move and a line per remaining point', () => {
    const d = linePath([0, 5, 10], 10, { left: 0, top: 0, width: 100, height: 100 })
    expect(d).toBe('M 0 100 L 50 50 L 100 0')
    expect(linePath([], 10, { left: 0, top: 0, width: 100, height: 100 })).toBe('')
  })

  it('finds the nearest point to the pointer and clamps to the ends', () => {
    expect(nearestIndex(40, 5, 40, 400)).toBe(0)
    expect(nearestIndex(440, 5, 40, 400)).toBe(4)
    expect(nearestIndex(250, 5, 40, 400)).toBe(2)
    expect(nearestIndex(-100, 5, 40, 400)).toBe(0)
    expect(nearestIndex(9999, 5, 40, 400)).toBe(4)
    expect(nearestIndex(10, 0, 40, 400)).toBe(-1)
    expect(nearestIndex(10, 1, 40, 400)).toBe(0)
  })

  it('sums', () => {
    expect(sum([1, 2, 3])).toBe(6)
    expect(sum([])).toBe(0)
  })
})
