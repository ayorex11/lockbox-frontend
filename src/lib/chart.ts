/** Tiny geometry helpers for the hand-rolled SVG charts (no chart library needed). */

export interface TrendSeries {
  key: string
  label: string
  color: 'primary' | 'tertiary' | 'secondary' | 'error'
  values: number[]
}

/**
 * Smallest "nice" axis maximum that fits `value`, divisible by `divisions` into whole-number
 * steps (counts are integers, so ticks like 2.5 would look wrong). 0 -> 4, 9 -> 12, 48 -> 48.
 */
export function niceMax(value: number, divisions = 4): number {
  const need = Math.max(1, Math.ceil((Number.isFinite(value) ? value : 0) / divisions))
  for (let exp = 1; ; exp *= 10) {
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8]) {
      const step = m * exp
      if (Number.isInteger(step) && step >= need) return step * divisions
    }
  }
}

/** X position of point `i` of `n`, spread across [left, left + width]. A single point is centred. */
export function xAt(i: number, n: number, left: number, width: number): number {
  return n <= 1 ? left + width / 2 : left + (i / (n - 1)) * width
}

/** Y position for `value` on a 0..max axis occupying [top, top + height] (0 sits at the bottom). */
export function yAt(value: number, max: number, top: number, height: number): number {
  return top + height - (max > 0 ? Math.min(Math.max(value, 0), max) / max : 0) * height
}

const r = (n: number) => Math.round(n * 100) / 100

/** SVG path "M x y L x y ..." for a series. */
export function linePath(values: number[], max: number, box: { left: number; top: number; width: number; height: number }): string {
  return values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${r(xAt(i, values.length, box.left, box.width))} ${r(yAt(v, max, box.top, box.height))}`)
    .join(' ')
}

/** Index of the point closest to pointer x (in the same units as `left`/`width`). -1 if there are no points. */
export function nearestIndex(x: number, n: number, left: number, width: number): number {
  if (n <= 0) return -1
  if (n === 1 || width <= 0) return 0
  return Math.min(n - 1, Math.max(0, Math.round(((x - left) / width) * (n - 1))))
}

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
