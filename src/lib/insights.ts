import type { AdminOverview } from './api'
import { formatPercent } from './format'

export type InsightSeverity = 'warn' | 'info' | 'good'
export interface Insight { id: string; severity: InsightSeverity; icon: string; title: string; detail: string }

/** Below this many data points a percentage is noise, so no advice is given. */
export const MIN_SAMPLE = 5
const MAX_INSIGHTS = 6
const rank: Record<InsightSeverity, number> = { warn: 0, info: 1, good: 2 }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Turns the numbers into plain-language "where to focus next" notes. Rule-based, deliberately simple. */
export function buildInsights(o: AdminOverview): Insight[] {
  const out: Insight[] = []
  const add = (i: Insight) => out.push(i)
  const { users, links, engagement, funnels } = o
  const fu = funnels.users, fl = funnels.links, up = funnels.uploads

  if (users.total === 0 && links.total === 0) {
    return [{
      id: 'no-data', severity: 'info', icon: 'hourglass_empty',
      title: 'No customer activity yet',
      detail: 'Staff accounts are excluded from every number here. Once real people sign up and send files, guidance will appear.',
    }]
  }

  // --- sign-up -> verified -> first link
  if (fu.signed_up >= MIN_SAMPLE && fu.verify_rate !== null && fu.verify_rate < 0.6) {
    add({
      id: 'verify', severity: 'warn', icon: 'mark_email_unread',
      title: `Only ${formatPercent(fu.verify_rate)} of sign-ups verify their email`,
      detail: `${plural(fu.signed_up - fu.verified, 'account')} never confirmed. Check that verification emails reach the inbox (Brevo logs, spam) and that the check-email screen makes the next step obvious.`,
    })
  }
  if (fu.verified >= MIN_SAMPLE && fu.link_rate !== null && fu.link_rate < 0.5) {
    add({
      id: 'activation', severity: 'warn', icon: 'person_off',
      title: 'Most verified users never send a file',
      detail: `${fu.verified - fu.created_a_link} of ${fu.verified} verified users have never created a link. A guided first send or a stronger empty state on the dashboard is the likely lever.`,
    })
  }
  if (users.senders_ever >= MIN_SAMPLE && users.active_senders_30d / users.senders_ever < 0.3) {
    add({
      id: 'retention', severity: 'warn', icon: 'event_busy',
      title: 'Most senders have not come back in 30 days',
      detail: `Only ${users.active_senders_30d} of ${users.senders_ever} people who ever sent a file created a link this month. Find out whether sending is a one-off need for your users.`,
    })
  }

  // --- upload -> link
  if (up.files_started >= MIN_SAMPLE && up.link_rate !== null && up.link_rate < 0.8) {
    add({
      id: 'uploads', severity: 'warn', icon: 'upload_file',
      title: 'Uploads drop off before a link is created',
      detail: `${up.files_never_linked} of ${up.files_started} uploads never got a link (this includes abandoned uploads). Look at the step between choosing a file and choosing sharing options.`,
    })
  }

  // --- created -> opened -> claimed
  if (fl.created >= MIN_SAMPLE && fl.open_rate !== null && fl.open_rate < 0.7) {
    add({
      id: 'unopened', severity: 'warn', icon: 'visibility_off',
      title: `${plural(fl.never_opened, 'link')} (${formatPercent(1 - fl.open_rate)}) never opened`,
      detail: 'Recipients may not receive or trust the link. A ready-to-send message next to the copy button could improve this.',
    })
  }
  if (fl.opened >= MIN_SAMPLE && fl.claimed / fl.opened < 0.6) {
    add({
      id: 'open-no-claim', severity: 'warn', icon: 'download_for_offline',
      title: 'People open links but do not download',
      detail: `${fl.claimed} of ${fl.opened} opened links were claimed. Password friction or the one-time warning copy may be putting recipients off. Compare with the password failures below.`,
    })
  }
  if (fl.expired_never_opened >= 3) {
    add({
      id: 'expired-unopened', severity: 'info', icon: 'timer_off',
      title: `${plural(fl.expired_never_opened, 'link')} expired without ever being opened`,
      detail: 'Short lifetimes can lapse before recipients look. Consider reminding senders, or suggesting a longer expiry.',
    })
  }

  // --- passwords
  if (engagement.password_failed >= MIN_SAMPLE && engagement.password_failed > engagement.claims * 0.5) {
    add({
      id: 'passwords', severity: 'warn', icon: 'key_off',
      title: 'Recipients struggle with link passwords',
      detail: `${engagement.password_failed} wrong attempts against ${engagement.claims} downloads. Prompt senders to share the password separately, or revisit the lockout rules.`,
    })
  }

  // --- feature mix
  if (links.total >= MIN_SAMPLE) {
    const oneTime = links.one_time / links.total
    const pw = links.password_protected / links.total
    add({
      id: 'mix', severity: 'info', icon: 'tune',
      title: `${formatPercent(oneTime)} of links are one-time, ${formatPercent(pw)} use a password`,
      detail: oneTime >= 0.5
        ? 'One-time is your core use case. Polish that flow first.'
        : 'Timed links dominate. Check that one-time links are easy to discover.',
    })
  }

  // --- bots
  const botOpens = engagement.opens_incl_bots - engagement.opens
  if (botOpens >= MIN_SAMPLE && botOpens / engagement.opens_incl_bots > 0.3) {
    add({
      id: 'bots', severity: 'info', icon: 'smart_toy',
      title: `Link previewers cause ${formatPercent(botOpens / engagement.opens_incl_bots)} of raw opens`,
      detail: 'They are filtered out of "opens" here. Treat downloads as the true engagement number.',
    })
  }

  // --- growth: last 7 days vs the weekly average of the 23 days before
  if (users.new_30d >= MIN_SAMPLE) {
    const before = ((users.new_30d - users.new_7d) * 7) / 23
    if (users.new_7d >= before * 1.25 && users.new_7d >= 3) {
      add({ id: 'growth-up', severity: 'good', icon: 'trending_up', title: 'Sign-ups are picking up', detail: `${plural(users.new_7d, 'sign-up')} this week versus about ${Math.round(before)} a week before. Note what changed.` })
    } else if (users.new_7d <= before * 0.5) {
      add({ id: 'growth-down', severity: 'warn', icon: 'trending_down', title: 'Sign-ups have slowed', detail: `${plural(users.new_7d, 'sign-up')} this week versus about ${Math.round(before)} a week before.` })
    }
  }

  // --- good news
  if (fl.created >= MIN_SAMPLE && fl.open_rate !== null && fl.claim_rate !== null && fl.open_rate >= 0.8 && fl.claim_rate >= 0.6) {
    add({
      id: 'landing', severity: 'good', icon: 'check_circle',
      title: 'Links are landing',
      detail: `${formatPercent(fl.open_rate)} get opened and ${formatPercent(fl.claim_rate)} get downloaded. The sharing flow works, so growth is probably the next lever.`,
    })
  }

  if (out.length === 0) {
    add({ id: 'steady', severity: 'good', icon: 'check_circle', title: 'Nothing needs attention', detail: 'No funnel is below its warning threshold, or there is not enough data yet to say.' })
  }

  // Stable sort by severity so warnings lead, keeping rule order within a group.
  return out
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank[a.item.severity] - rank[b.item.severity] || a.index - b.index)
    .map(({ item }) => item)
    .slice(0, MAX_INSIGHTS)
}
