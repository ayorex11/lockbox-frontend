import { describe, expect, it } from 'vitest'
import type { AdminOverview } from '@/lib/api'
import { buildInsights } from '@/lib/insights'

/** A healthy, busy product. Individual tests break one thing at a time. */
function overview(patch: (o: AdminOverview) => void = () => {}): AdminOverview {
  const o: AdminOverview = {
    generated_at: '2026-10-02T10:00:00Z',
    users: { total: 100, verified: 90, new_7d: 10, new_30d: 33, senders_ever: 60, active_senders_7d: 20, active_senders_30d: 40 },
    links: { total: 200, active: 20, used: 100, expired: 70, revoked: 10, one_time: 120, timed: 80, password_protected: 60, created_7d: 40, created_30d: 150 },
    engagement: { claims: 150, opens: 180, opens_incl_bots: 190, password_failed: 3, locked_out: 0 },
    funnels: {
      users: { signed_up: 100, verified: 90, created_a_link: 60, verify_rate: 0.9, link_rate: 0.667 },
      links: { created: 200, opened: 170, claimed: 150, open_rate: 0.85, claim_rate: 0.75, never_opened: 30, expired_never_opened: 1 },
      uploads: { files_started: 220, files_never_linked: 20, link_rate: 0.91 },
    },
    storage: { files_in_storage: 20, bytes_in_storage: 1000, bytes_shared_all_time: 5000 },
  }
  patch(o)
  return o
}
const ids = (o: AdminOverview) => buildInsights(o).map((i) => i.id)

describe('buildInsights', () => {
  it('says there is no data yet instead of inventing advice', () => {
    const empty = overview((o) => {
      o.users.total = 0
      o.links.total = 0
    })
    expect(buildInsights(empty).map((i) => i.id)).toEqual(['no-data'])
  })

  it('reports good news for a healthy product, without warnings', () => {
    const found = buildInsights(overview())
    expect(found.some((i) => i.severity === 'warn')).toBe(false)
    expect(found.map((i) => i.id)).toContain('landing')
  })

  it('flags low email verification', () => {
    const found = ids(overview((o) => {
      o.funnels.users.verify_rate = 0.3
      o.funnels.users.verified = 30
    }))
    expect(found).toContain('verify')
  })

  it('flags verified users who never send', () => {
    expect(ids(overview((o) => { o.funnels.users.link_rate = 0.2; o.funnels.users.created_a_link = 18 }))).toContain('activation')
  })

  it('flags links that are opened but not downloaded', () => {
    expect(ids(overview((o) => { o.funnels.links.claimed = 50 }))).toContain('open-no-claim')
  })

  it('flags unopened links', () => {
    expect(ids(overview((o) => { o.funnels.links.open_rate = 0.4; o.funnels.links.never_opened = 120 }))).toContain('unopened')
  })

  it('flags password trouble only when failures are frequent relative to downloads', () => {
    expect(ids(overview((o) => { o.engagement.password_failed = 100 }))).toContain('passwords')
    expect(ids(overview((o) => { o.engagement.password_failed = 4 }))).not.toContain('passwords')
  })

  it('gives no percentage-based advice below the minimum sample size', () => {
    const tiny = overview((o) => {
      o.users.total = 3
      o.users.verified = 0
      o.funnels.users = { signed_up: 3, verified: 0, created_a_link: 0, verify_rate: 0, link_rate: null }
      o.links.total = 2
      o.funnels.links = { created: 2, opened: 0, claimed: 0, open_rate: 0, claim_rate: 0, never_opened: 2, expired_never_opened: 0 }
      o.funnels.uploads = { files_started: 2, files_never_linked: 2, link_rate: 0 }
      o.users.senders_ever = 0
      o.users.new_30d = 3
      o.engagement = { claims: 0, opens: 0, opens_incl_bots: 0, password_failed: 0, locked_out: 0 }
    })
    expect(ids(tiny)).toEqual(['steady'])
  })

  it('detects a sign-up slowdown and a surge', () => {
    expect(ids(overview((o) => { o.users.new_30d = 40; o.users.new_7d = 1 }))).toContain('growth-down')
    expect(ids(overview((o) => { o.users.new_30d = 30; o.users.new_7d = 15 }))).toContain('growth-up')
  })

  it('lists warnings before info before good news, and caps the list', () => {
    const noisy = overview((o) => {
      o.funnels.users.verify_rate = 0.2
      o.funnels.users.link_rate = 0.1
      o.funnels.users.created_a_link = 5
      o.funnels.links.open_rate = 0.3
      o.funnels.links.claimed = 20
      o.engagement.password_failed = 200
      o.funnels.uploads.link_rate = 0.3
      o.users.active_senders_30d = 2
    })
    const found = buildInsights(noisy)
    expect(found.length).toBeLessThanOrEqual(6)
    const order = found.map((i) => ({ warn: 0, info: 1, good: 2 })[i.severity])
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(found[0]!.severity).toBe('warn')
  })
})
