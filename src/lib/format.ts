export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, '')} ${units[i]}`
}

const dateTime = new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
})
const dateOnly = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso))
}

/** "Today, 10:14 AM" / "Yesterday, 4:30 PM" / "Oct 24" */
export function formatCreated(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d)
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (days === 0) return `Today, ${time}`
  if (days === 1) return `Yesterday, ${time}`
  return dateOnly.format(d)
}

/** Compact duration: "3d 4h", "18h 20m", "45m", "30s". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86_400)
  const h = Math.floor((total % 86_400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return `${s}s`
}

/** mm:ss for short countdowns (lockouts). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function timeLeft(expiresAtIso: string, now = Date.now()): string {
  const ms = new Date(expiresAtIso).getTime() - now
  return ms <= 0 ? 'Expired' : formatDuration(ms)
}

/** Material Symbols icon for a file, by extension. */
export function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'picture_as_pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg'].includes(ext)) return 'image'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'folder_zip'
  if (['mp4', 'mov', 'mkv', 'avi', 'webm'].includes(ext)) return 'movie'
  if (['mp3', 'wav', 'm4a', 'flac'].includes(ext)) return 'audio_file'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'table_chart'
  return 'description'
}

/** "198.51.100.0/24" -> "198.51.100.x network" (the API stores truncated networks, never full IPs). */
export function displayNetwork(truncated: string): string {
  if (!truncated) return 'Unknown network'
  const v4 = /^(\d+\.\d+\.\d+)\.0\/24$/.exec(truncated)
  return v4 ? `${v4[1]}.x network` : `${truncated} network`
}

export function buildShareUrl(linkId: string, key: string, origin = window.location.origin): string {
  return `${origin}/s/${linkId}#${key}`
}

/** 0.4286 -> "43%". null (nothing to divide by) -> "—". */
export function formatPercent(rate: number | null | undefined): string {
  return rate === null || rate === undefined || !Number.isFinite(rate) ? '—' : `${Math.round(rate * 100)}%`
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
/** 1200 -> "1.2K". Used for chart axes. */
export function formatCompact(value: number): string {
  return compact.format(value)
}

const shortDate = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
/** "2026-10-02" -> "Oct 2". The API buckets days in UTC, so display them in UTC too. */
export function formatShortDate(day: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? day : shortDate.format(d)
}
