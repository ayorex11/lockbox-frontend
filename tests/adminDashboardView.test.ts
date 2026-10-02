import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  adminApi, ApiError,
  type AdminOverview, type AdminSecurity, type AdminTimeseries, type AdminTopUsers,
} from '@/lib/api'
import AdminDashboardView from '@/views/admin/AdminDashboardView.vue'

const overview: AdminOverview = {
  generated_at: '2026-10-02T10:00:00Z',
  users: { total: 42, verified: 30, new_7d: 6, new_30d: 20, senders_ever: 18, active_senders_7d: 7, active_senders_30d: 12 },
  links: { total: 80, active: 9, used: 40, expired: 25, revoked: 6, one_time: 50, timed: 30, password_protected: 16, created_7d: 14, created_30d: 60 },
  engagement: { claims: 55, opens: 70, opens_incl_bots: 75, password_failed: 2, locked_out: 0 },
  funnels: {
    users: { signed_up: 42, verified: 30, created_a_link: 18, verify_rate: 0.714, link_rate: 0.6 },
    links: { created: 80, opened: 68, claimed: 55, open_rate: 0.85, claim_rate: 0.6875, never_opened: 12, expired_never_opened: 2 },
    uploads: { files_started: 90, files_never_linked: 10, link_rate: 0.89 },
  },
  storage: { files_in_storage: 9, bytes_in_storage: 5 * 1024 * 1024, bytes_shared_all_time: 120 * 1024 * 1024 },
}
const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}`
const timeseries: AdminTimeseries = {
  days: 3,
  series: [1, 2, 3].map((n) => ({ date: day(n), signups: n, links_created: n * 2, opens: n, claims: n })),
}
const topUsers: AdminTopUsers = {
  metric: 'links',
  results: [
    { email: 'heavy@example.com', links: 12, claims: 30, bytes_shared: 2048, last_link_at: '2026-10-01T09:00:00Z', joined_at: '2026-08-01T09:00:00Z' },
    { email: 'light@example.com', links: 2, claims: 3, bytes_shared: 10, last_link_at: null, joined_at: '2026-09-01T09:00:00Z' },
  ],
}
const security: AdminSecurity = {
  windows: { '24h': { password_failed: 1, locked_out: 0 }, '7d': { password_failed: 4, locked_out: 1 }, '30d': { password_failed: 9, locked_out: 2 } },
  links_with_failures_7d: 3,
  series: [1, 2].map((n) => ({ date: day(n), password_failed: n, locked_out: 0 })),
}

describe('AdminDashboardView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(adminApi, 'overview').mockResolvedValue(overview)
    vi.spyOn(adminApi, 'timeseries').mockResolvedValue(timeseries)
    vi.spyOn(adminApi, 'topUsers').mockResolvedValue(topUsers)
    vi.spyOn(adminApi, 'security').mockResolvedValue(security)
  })
  afterEach(() => vi.restoreAllMocks())

  it('loads every section on mount and shows headline numbers, funnels and top senders', async () => {
    const wrapper = mount(AdminDashboardView)
    await flushPromises()
    expect(adminApi.timeseries).toHaveBeenCalledWith(30)
    expect(adminApi.topUsers).toHaveBeenCalledWith('links', 10)
    const text = wrapper.text()
    expect(text).toContain('Insights')
    expect(text).toContain('42') // users
    expect(text).toContain('55') // downloads
    expect(text).toContain('85%') // open rate
    expect(text).toContain('5 MB') // storage in use
    expect(text).toContain('Signed up')
    expect(text).toContain('heavy@example.com')
    expect(text).toContain('Last 7 days')
    expect(text).toContain('Where to focus next')
  })

  it('reloads only the trend data when the range changes', async () => {
    const wrapper = mount(AdminDashboardView)
    await flushPromises()
    vi.mocked(adminApi.overview).mockClear()
    const ninety = wrapper.findAll('button[role="radio"]').find((b) => b.text() === '90 days')!
    await ninety.trigger('click')
    await flushPromises()
    expect(adminApi.timeseries).toHaveBeenLastCalledWith(90)
    expect(adminApi.overview).not.toHaveBeenCalled()
  })

  it('re-ranks top senders when the metric changes', async () => {
    const wrapper = mount(AdminDashboardView)
    await flushPromises()
    const downloads = wrapper.findAll('button[role="radio"]').find((b) => b.text() === 'Downloads')!
    await downloads.trigger('click')
    await flushPromises()
    expect(adminApi.topUsers).toHaveBeenLastCalledWith('claims', 10)
  })

  it('shows a retry state when the overview cannot be loaded', async () => {
    vi.mocked(adminApi.overview).mockRejectedValue(new ApiError(500, 'http_500'))
    const wrapper = mount(AdminDashboardView)
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('went wrong on our side')
    expect(wrapper.text()).not.toContain('Where to focus next')
  })

  it('explains a revoked staff session instead of rendering an empty page', async () => {
    vi.mocked(adminApi.overview).mockRejectedValue(new ApiError(403, 'staff_only'))
    const wrapper = mount(AdminDashboardView)
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain("don't have access")
  })
})
