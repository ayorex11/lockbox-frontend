import { createRouter, createWebHistory } from 'vue-router'
import { setSessionLostHandler } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    title?: string
  }
}

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (to, _from, saved) => saved ?? (to.hash ? { el: to.hash, behavior: 'smooth' } : { top: 0 }),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/PublicLayout.vue'),
      children: [{ path: '', name: 'landing', component: () => import('@/views/LandingView.vue'), meta: { title: 'Lockbox — private file sharing' } }],
    },
    {
      path: '/',
      component: () => import('@/layouts/CenteredLayout.vue'),
      children: [
        { path: 'login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guestOnly: true, title: 'Log in' } },
        { path: 'signup', name: 'signup', component: () => import('@/views/SignupView.vue'), meta: { guestOnly: true, title: 'Create account' } },
        { path: 'check-email', name: 'check-email', component: () => import('@/views/CheckEmailView.vue'), meta: { title: 'Check your inbox' } },
        { path: 'verify-email', name: 'verify-email', component: () => import('@/views/VerifyEmailView.vue'), meta: { title: 'Confirm your email' } },
        { path: 's/:token', name: 'recipient', component: () => import('@/views/RecipientView.vue'), meta: { title: 'Private file shared with you' } },
        { path: ':pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue'), meta: { title: 'Page not found' } },
      ],
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: 'My files' } },
        { path: 'send', name: 'send', component: () => import('@/views/SendView.vue'), meta: { title: 'Send a file' } },
        { path: 'links/:id', name: 'link-activity', component: () => import('@/views/LinkActivityView.vue'), props: true, meta: { title: 'Activity' } },
        { path: 'links/:id/ready', name: 'link-ready', component: () => import('@/views/LinkReadyView.vue'), props: true, meta: { title: 'Your link is ready' } },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth || to.meta.guestOnly) await auth.bootstrap()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'dashboard' }
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Lockbox` : 'Lockbox'
})

/** If a refresh fails mid-session, drop to the login screen and come back afterwards. */
export function installSessionGuard() {
  setSessionLostHandler(() => {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) return
    auth.clearSession()
    const here = router.currentRoute.value
    if (here.meta.requiresAuth) router.replace({ name: 'login', query: { redirect: here.fullPath } })
  })
}
