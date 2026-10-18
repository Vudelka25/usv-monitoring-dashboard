import { describe, expect, it } from 'vitest'
import type {
  TelemetryProcessingResult,
  TelemetrySample,
} from '../types/telemetry.types'
import { isGpsStale, processTelemetrySample, validateTelemetrySample } from './telemetryProcessor'

const sample: TelemetrySample = {
  timestamp: 1_700_000_000_000,
  sequenceNumber: 1,
  gps: {
    latitude: 45.71,
    longitude: 31.09,
    accuracyMeters: 1.8,
    fixTimestamp: 1_700_000_000_000,
  },
  pose: { yawDegrees: 156.2, pitchDegrees: 1.8, rollDegrees: -2.4 },
  battery: { stateOfChargePercent: 78, voltageVolts: 24.6, currentAmps: 4.2 },
}

function getTelemetry(result: TelemetryProcessingResult) {
  if (!result.valid) throw new Error(result.errors.join(', '))
  return result.telemetry
}

describe('telemetryProcessor', () => {
  it('accepts a valid sample without changing its raw readings', () => {
    const result = validateTelemetrySample(sample)

    expect(result).toEqual({ valid: true, sample })
  })

  it.each([
    ['latitude out of range', { gps: { ...sample.gps, latitude: 91 } }],
    ['longitude out of range', { gps: { ...sample.gps, longitude: 181 } }],
    ['negative GPS accuracy', { gps: { ...sample.gps, accuracyMeters: -1 } }],
    ['missing GPS fix timestamp', { gps: { latitude: 45.71, longitude: 31.09, accuracyMeters: 1.8 } }],
    ['non-integer GPS fix timestamp', { gps: { ...sample.gps, fixTimestamp: 1.5 } }],
    [
      'GPS fix timestamp after the sample timestamp',
      { gps: { ...sample.gps, fixTimestamp: sample.timestamp + 1 } },
    ],
    [
      'invalid state of charge',
      { battery: { ...sample.battery, stateOfChargePercent: 101 } },
    ],
    ['non-finite pose', { pose: { ...sample.pose, rollDegrees: Number.NaN } }],
    ['non-finite battery value', {
      battery: { ...sample.battery, voltageVolts: Number.POSITIVE_INFINITY },
    }],
    ['invalid timestamp', { timestamp: Number.NaN }],
    ['invalid sequence number', { sequenceNumber: 1.5 }],
  ])('rejects %s', (_description, override) => {
    const invalidSample = { ...sample, ...override }

    expect(validateTelemetrySample(invalidSample).valid).toBe(false)
  })

  it('rejects malformed unknown input with explicit errors', () => {
    const result = processTelemetrySample({ timestamp: 'not a timestamp' })

    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.length).toBeGreaterThan(0)
  })

  it.each([
    [-10, 350],
    [725, 5],
  ])('normalizes yaw %i to %i degrees', (yawDegrees, expected) => {
    const result = processTelemetrySample({
      ...sample,
      pose: { ...sample.pose, yawDegrees },
    })

    expect(getTelemetry(result).normalizedYawDegrees).toBe(expected)
  })

  it('calculates battery power in watts', () => {
    const result = processTelemetrySample(sample)

    expect(getTelemetry(result).batteryPowerWatts).toBeCloseTo(103.32)
  })

  it.each([
    ['overflowing positive power', 1e200, 1e200],
    ['overflowing negative power', -1e200, 1e200],
  ])('rejects a sample with %s instead of exposing a non-finite value', (_description, voltageVolts, currentAmps) => {
    const result = processTelemetrySample({
      ...sample,
      battery: { ...sample.battery, voltageVolts, currentAmps },
    })

    expect(result).toEqual({ valid: false, errors: ['battery power must be a finite number'] })
  })

  it('does not apply an arbitrary limit to large but finite battery power', () => {
    const result = processTelemetrySample({
      ...sample,
      battery: { ...sample.battery, voltageVolts: 1e150, currentAmps: 1e150 },
    })

    expect(Number.isFinite(getTelemetry(result).batteryPowerWatts)).toBe(true)
    expect(getTelemetry(result).batteryPowerWatts).toBeGreaterThan(1e299)
  })

  it('applies strict GPS advisory and battery critical thresholds', () => {
    const atThreshold = processTelemetrySample({
      ...sample,
      gps: { ...sample.gps, accuracyMeters: 10 },
      battery: { ...sample.battery, stateOfChargePercent: 15 },
    })
    const aboveThreshold = processTelemetrySample({
      ...sample,
      gps: { ...sample.gps, accuracyMeters: 10.01 },
      battery: { ...sample.battery, stateOfChargePercent: 14.99 },
    })

    expect(getTelemetry(atThreshold).advisories).toEqual({
      gpsAccuracy: false,
      batteryCritical: false,
    })
    expect(getTelemetry(aboveThreshold).advisories).toEqual({
      gpsAccuracy: true,
      batteryCritical: true,
    })
  })

  it('treats a GPS fix as stale from 3 seconds old', () => {
    expect(isGpsStale(10_000, 12_999)).toBe(false)
    expect(isGpsStale(10_000, 13_000)).toBe(true)
    expect(isGpsStale(10_000, 10_000)).toBe(false)
  })
})