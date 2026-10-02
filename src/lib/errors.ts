import { ApiError, NetworkError } from './api'

/** Friendly message for errors that aren't handled inline by a view. */
export function describeError(error: unknown): string {
  if (error instanceof NetworkError) return "Can't reach Lockbox. Check your connection and try again."
  if (error instanceof ApiError) {
    if (error.status === 403) return "You don't have access to this."
    if (error.status === 429) return 'Too many requests. Please wait a moment and try again.'
    if (error.status >= 500) return 'Something went wrong on our side. Please try again shortly.'
  }
  return 'Something went wrong. Please try again.'
}
