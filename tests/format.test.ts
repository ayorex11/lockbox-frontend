import { describe, expect, it } from 'vitest'
import { buildShareUrl, displayNetwork, fileIcon, formatBytes, formatClock, formatCreated, formatDuration, timeLeft } from '@/lib/format'
import { summarizeUserAgent } from '@/lib/ua'

describe('format', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1023)).toBe('1023 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(4_404_019)).toBe('4.2 MB')
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB')
    expect(formatBytes(NaN)).toBe('—')
  })

  it('formats durations and clocks', () => {
    expect(formatDuration(45_000)).toBe('45s')
    expect(formatDuration(90 * 60_000)).toBe('1h 30m')
    expect(formatDuration(3 * 86_400_000 + 4 * 3_600_000)).toBe('3d 4h')
    expect(formatDuration(-5)).toBe('0s')
    expect(formatClock(75)).toBe('1:15')
    expect(formatClock(9.2)).toBe('0:10')
  })

  it('reports time left', () => {
    const now = Date.parse('2026-01-01T00:00:00Z')
    expect(timeLeft('2026-01-01T02:00:00Z', now)).toBe('2h')
    expect(timeLeft('2025-12-31T23:59:00Z', now)).toBe('Expired')
  })

  it('labels created dates relative to today', () => {
    const now = new Date(2026, 5, 15, 12, 0)
    expect(formatCreated(new Date(2026, 5, 15, 9, 30).toISOString(), now)).toMatch(/^Today, /)
    expect(formatCreated(new Date(2026, 5, 14, 23, 0).toISOString(), now)).toMatch(/^Yesterday, /)
    expect(formatCreated(new Date(2026, 4, 1).toISOString(), now)).not.toMatch(/Today|Yesterday/)
  })

  it('picks file icons and hides IP detail', () => {
    expect(fileIcon('scan.PDF')).toBe('picture_as_pdf')
    expect(fileIcon('me.png')).toBe('image')
    expect(fileIcon('noext')).toBe('description')
    expect(displayNetwork('198.51.100.0/24')).toBe('198.51.100.x network')
    expect(displayNetwork('2001:db8:abcd::/48')).toBe('2001:db8:abcd::/48 network')
    expect(displayNetwork('')).toBe('Unknown network')
  })

  it('builds share URLs with the key in the fragment', () => {
    expect(buildShareUrl('abc', 'KEY', 'https://app.example.com')).toBe('https://app.example.com/s/abc#KEY')
  })

  it('summarises user agents', () => {
    expect(summarizeUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36')).toBe('Chrome on macOS')
    expect(summarizeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17 Safari/604.1')).toBe('Safari on iOS')
    expect(summarizeUserAgent('')).toBe('Unknown device')
  })
})
