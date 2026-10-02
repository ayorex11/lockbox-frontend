import { describe, expect, it } from 'vitest'
import { passwordAcceptable, passwordChecks, passwordScore, strengthLabel } from '@/lib/password'

describe('account password hints', () => {
  it('requires 10 characters and letters plus numbers', () => {
    expect(passwordAcceptable('short1')).toBe(false)
    expect(passwordAcceptable('onlylettersandmore')).toBe(false)
    expect(passwordAcceptable('12345678901234')).toBe(false)
    expect(passwordAcceptable('tangerine-lamp-42')).toBe(true)
  })

  it('reports each rule separately', () => {
    expect(passwordChecks('abc').map((c) => c.ok)).toEqual([false, false])
    expect(passwordChecks('abcdefghij1').map((c) => c.ok)).toEqual([true, true])
  })

  it('scores and labels strength', () => {
    expect(passwordScore('')).toBe(0)
    expect(passwordScore('abc')).toBe(0)
    expect(passwordScore('tangerine-lamp-42')).toBeGreaterThanOrEqual(3)
    expect(strengthLabel(0)).toBe('Weak')
    expect(strengthLabel(4)).toBe('Strong')
  })
})
