/** Pure route-guard rules, kept free of router/store imports so they're trivial to test. */
export interface GuardMeta { requiresAuth?: boolean; requiresStaff?: boolean; guestOnly?: boolean }
export interface GuardSession { isAuthenticated: boolean; isStaff: boolean }
export type GuardRedirect = { name: string; query?: Record<string, string> }

/** Where to send the visitor instead of the page they asked for, or null to let them through. */
export function guardRedirect(
  to: { meta: GuardMeta; fullPath: string },
  session: GuardSession,
): GuardRedirect | null {
  if ((to.meta.requiresAuth || to.meta.requiresStaff) && !session.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  // Non-staff are bounced quietly: the API enforces this too, this just avoids a dead page.
  if (to.meta.requiresStaff && !session.isStaff) return { name: 'dashboard' }
  if (to.meta.guestOnly && session.isAuthenticated) return { name: 'dashboard' }
  return null
}
