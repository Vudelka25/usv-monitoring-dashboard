export function formatCoordinate(
  value: number,
  axis: 'latitude' | 'longitude',
): string {
  const direction =
    axis === 'latitude'
      ? value < 0
        ? 'S'
        : 'N'
      : value < 0
        ? 'W'
        : 'E'

  return `${Math.abs(value).toFixed(4)}° ${direction}`
}

export function formatDegrees(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value).toFixed(1)}°`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

export function formatAge(timestamp: number, now = Date.now()): string {
  const totalSeconds = Math.max(0, Math.floor((now - timestamp) / 1_000))
  if (totalSeconds < 60) return `${totalSeconds}s ago`

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s ago`
}