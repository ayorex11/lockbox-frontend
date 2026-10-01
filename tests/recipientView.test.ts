import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { recipientApi, type LinkMeta } from '@/lib/api'
import { generateKey } from '@/lib/crypto'
import RecipientView from '@/views/RecipientView.vue'

const meta: LinkMeta = {
  available: true, name: 'passport-scan.pdf', size: 123_456, mode: 'one_time',
  expires_at: new Date(Date.now() + 86_400_000).toISOString(), requires_password: true, sender_email: 'alex@example.com',
}

async function mountAt(hash: string) {
  window.location.hash = hash
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/s/:token', component: RecipientView },
      { path: '/:rest(.*)*', component: { template: '<div />' }, name: 'other' },
      { path: '/send', name: 'send', component: { template: '<div />' } },
      { path: '/', name: 'landing', component: { template: '<div />' } },
    ],
  })
  await router.push('/s/tok123')
  const wrapper = mount(RecipientView, { global: { plugins: [createPinia(), router] } })
  await flushPromises()
  return wrapper
}

describe('RecipientView', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { window.location.hash = '' })

  it('shows file details, sender, the one-time rule and a password field when the link is valid', async () => {
    vi.spyOn(recipientApi, 'meta').mockResolvedValue(meta)
    const wrapper = await mountAt(`#${generateKey()}`)
    const text = wrapper.text()
    expect(text).toContain('passport-scan.pdf')
    expect(text).toContain('alex@example.com')
    expect(text).toContain('This link works once')
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined() // needs the password first
  })

  it('hides the sender line when the sender opted out', async () => {
    vi.spyOn(recipientApi, 'meta').mockResolvedValue({ ...meta, sender_email: null })
    const wrapper = await mountAt(`#${generateKey()}`)
    expect(wrapper.text()).not.toContain('From')
  })

  it('explains an incomplete link when the key is missing, without offering a download', async () => {
    vi.spyOn(recipientApi, 'meta').mockResolvedValue(meta)
    const wrapper = await mountAt('')
    expect(wrapper.text()).toContain('This link is incomplete')
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
  })

  it('recovers when the full link is pasted into the same tab (only the fragment changes)', async () => {
    vi.spyOn(recipientApi, 'meta').mockResolvedValue(meta)
    const wrapper = await mountAt('')
    expect(wrapper.text()).toContain('This link is incomplete')
    window.location.hash = `#${generateKey()}`
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await flushPromises()
    expect(wrapper.text()).toContain('Unlock & download')
    expect(wrapper.text()).not.toContain('This link is incomplete')
  })

  it.each([
    ['expired', 'This link has expired'],
    ['unavailable', 'This link is no longer available'],
  ] as const)('shows the %s screen and leaks no file details', async (reason, heading) => {
    vi.spyOn(recipientApi, 'meta').mockResolvedValue({ available: false, reason })
    const wrapper = await mountAt(`#${generateKey()}`)
    expect(wrapper.text()).toContain(heading)
    expect(wrapper.text()).not.toContain('passport-scan.pdf')
    expect(wrapper.text()).not.toContain('alex@example.com')
  })

  it('shows a retry option when the link cannot be loaded', async () => {
    const { NetworkError } = await import('@/lib/api')
    vi.spyOn(recipientApi, 'meta').mockRejectedValue(new NetworkError())
    const wrapper = await mountAt(`#${generateKey()}`)
    expect(wrapper.text()).toContain("couldn't load this link")
    expect(wrapper.text()).toContain('Try again')
  })
})
