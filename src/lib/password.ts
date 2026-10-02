/** Client-side hints for choosing an account password. The API enforces the real rules
 *  (length, letters and numbers, common-password list, similarity to the email). */
export interface PasswordCheck { ok: boolean; text: string }

export function passwordChecks(p: string): PasswordCheck[] {
  return [
    { ok: p.length >= 10, text: 'At least 10 characters' },
    { ok: /[A-Za-z]/.test(p) && /\d/.test(p), text: 'A mix of letters and numbers' },
  ]
}

export function passwordScore(p: string): number {
  if (!p) return 0
  let score = 0
  if (p.length >= 10) score++
  if (p.length >= 14) score++
  if (/[A-Za-z]/.test(p) && /\d/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p) || (/[a-z]/.test(p) && /[A-Z]/.test(p))) score++
  return score
}

export const strengthLabel = (score: number): string => ['', 'Weak', 'Okay', 'Good', 'Strong'][score] || 'Weak'

export const passwordAcceptable = (p: string): boolean => passwordChecks(p).every((c) => c.ok)
