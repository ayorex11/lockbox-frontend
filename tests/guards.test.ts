import { describe, expect, it } from 'vitest'
import { guardRedirect } from '@/router/guards'

const anon = { isAuthenticated: false, isStaff: false }
const user = { isAuthenticated: true, isStaff: false }
const staff = { isAuthenticated: true, isStaff: true }
const admin = { meta: { requiresAuth: true, requiresStaff: true }, fullPath: '/admin' }

describe('route guard', () => {
  it('sends anonymous visitors to login and remembers where they were going', () => {
    expect(guardRedirect(admin, anon)).toEqual({ name: 'login', query: { redirect: '/admin' } })
    expect(guardRedirect({ meta: { requiresAuth: true }, fullPath: '/send' }, anon)).toEqual({
      name: 'login', query: { redirect: '/send' },
    })
  })

  it('bounces signed-in non-staff away from admin pages', () => {
    expect(guardRedirect(admin, user)).toEqual({ name: 'dashboard' })
  })

  it('lets staff into admin pages', () => {
    expect(guardRedirect(admin, staff)).toBeNull()
  })

  it('still lets any signed-in user into ordinary app pages', () => {
    expect(guardRedirect({ meta: { requiresAuth: true }, fullPath: '/dashboard' }, user)).toBeNull()
  })

  it('treats a staff-only route as needing a login even if requiresAuth is missing', () => {
    expect(guardRedirect({ meta: { requiresStaff: true }, fullPath: '/admin' }, anon)).toEqual({
      name: 'login', query: { redirect: '/admin' },
    })
  })

  it('keeps signed-in users off guest-only pages', () => {
    expect(guardRedirect({ meta: { guestOnly: true }, fullPath: '/login' }, user)).toEqual({ name: 'dashboard' })
    expect(guardRedirect({ meta: { guestOnly: true }, fullPath: '/login' }, anon)).toBeNull()
  })
})
