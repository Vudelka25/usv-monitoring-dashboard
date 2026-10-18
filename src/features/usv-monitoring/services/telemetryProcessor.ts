import type {
  TelemetryProcessingResult,
  TelemetrySample,
  TelemetryValidationResult,
} from '../types/telemetry.types'

const MAX_DATE_TIMESTAMP = 8_640_000_000_000_000
const GPS_ADVISORY_ACCURACY_METERS = 10
const GPS_STALE_AFTER_MS = 3_000
const BATTERY_CRITICAL_PERCENT = 15

export function isGpsStale(fixTimestamp: number, now: number): boolean {
  return now - fixTimestamp >= GPS_STALE_AFTER_MS
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRecord(
  value: unknown,
  name: string,
  errors: string[],
): UnknownRecord | undefined {
  if (!isRecord(value)) {
    errors.push(`${name} must be an object`)
    return undefined
  }
  return value
}

function readNumber(
  record: UnknownRecord,
  field: string,
  name: string,
  errors: string[],
  bounds: { minimum?: number; maximum?: number; integer?: boolean } = {},
): number | undefined {
  const value = record[field]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${name} must be a finite number`)
    return undefined
  }
  if (bounds.integer && !Number.isSafeInteger(value)) {
    errors.push(`${name} must be an integer`)
  }
  if (bounds.minimum !== undefined && value < bounds.minimum) {
    errors.push(`${name} must be at least ${bounds.minimum}`)
  }
  if (bounds.maximum !== undefined && value > bounds.maximum) {
    errors.push(`${name} must be at most ${bounds.maximum}`)
  }
  return value
}

export function validateTelemetrySample(
  input: unknown,
): TelemetryValidationResult {
  const errors: string[] = []
  const sample = readRecord(input, 'sample', errors)
  if (!sample) return { valid: false, errors }

  const timestamp = readNumber(sample, 'timestamp', 'timestamp', errors, {
    minimum: 0,
    maximum: MAX_DATE_TIMESTAMP,
    integer: true,
  })
  const sequenceNumber = readNumber(
    sample,
    'sequenceNumber',
    'sequenceNumber',
    errors,
    { minimum: 1, integer: true },
  )

  const gps = readRecord(sample.gps, 'gps', errors)
  const latitude = gps
    ? readNumber(gps, 'latitude', 'gps.latitude', errors, {
        minimum: -90,
        maximum: 90,
      })
    : undefined
  const longitude = gps
    ? readNumber(gps, 'longitude', 'gps.longitude', errors, {
        minimum: -180,
        maximum: 180,
      })
    : undefined
  const accuracyMeters = gps
    ? readNumber(gps, 'accuracyMeters', 'gps.accuracyMeters', errors, {
        minimum: 0,
      })
    : undefined
  const fixTimestamp = gps
    ? readNumber(gps, 'fixTimestamp', 'gps.fixTimestamp', errors, {
        minimum: 0,
        maximum: MAX_DATE_TIMESTAMP,
        integer: true,
      })
    : undefined
  if (
    fixTimestamp !== undefined &&
    timestamp !== undefined &&
    fixTimestamp > timestamp
  ) {
    errors.push('gps.fixTimestamp must not be after timestamp')
  }

  const pose = readRecord(sample.pose, 'pose', errors)
  const yawDegrees = pose
    ? readNumber(pose, 'yawDegrees', 'pose.yawDegrees', errors)
    : undefined
  const pitchDegrees = pose
    ? readNumber(pose, 'pitchDegrees', 'pose.pitchDegrees', errors)
    : undefined
  const rollDegrees = pose
    ? readNumber(pose, 'rollDegrees', 'pose.rollDegrees', errors)
    : undefined

  const battery = readRecord(sample.battery, 'battery', errors)
  const stateOfChargePercent = battery
    ? readNumber(
        battery,
        'stateOfChargePercent',
        'battery.stateOfChargePercent',
        errors,
        { minimum: 0, maximum: 100 },
      )
    : undefined
  const voltageVolts = battery
    ? readNumber(battery, 'voltageVolts', 'battery.voltageVolts', errors)
    : undefined
  const currentAmps = battery
    ? readNumber(battery, 'currentAmps', 'battery.currentAmps', errors)
    : undefined

  if (errors.length > 0) return { valid: false, errors }

  if (
    timestamp === undefined ||
    sequenceNumber === undefined ||
    latitude === undefined ||
    longitude === undefined ||
    accuracyMeters === undefined ||
    fixTimestamp === undefined ||
    yawDegrees === undefined ||
    pitchDegrees === undefined ||
    rollDegrees === undefined ||
    stateOfChargePercent === undefined ||
    voltageVolts === undefined ||
    currentAmps === undefined
  ) {
    return { valid: false, errors: ['sample is incomplete'] }
  }

  const validatedSample: TelemetrySample = {
    timestamp,
    sequenceNumber,
    gps: { latitude, longitude, accuracyMeters, fixTimestamp },
    pose: { yawDegrees, pitchDegrees, rollDegrees },
    battery: { stateOfChargePercent, voltageVolts, currentAmps },
  }

  return { valid: true, sample: validatedSample }
}

export function processTelemetrySample(
  input: unknown,
): TelemetryProcessingResult {
  const validation = validateTelemetrySample(input)
  if (!validation.valid) return validation

  const { sample } = validation
  const batteryPowerWatts =
    sample.battery.voltageVolts * sample.battery.currentAmps
  if (!Number.isFinite(batteryPowerWatts)) {
    return { valid: false, errors: ['battery power must be a finite number'] }
  }

  return {
    valid: true,
    telemetry: {
      sample,
      normalizedYawDegrees: ((sample.pose.yawDegrees % 360) + 360) % 360,
      batteryPowerWatts,
      advisories: {
        gpsAccuracy:
          sample.gps.accuracyMeters > GPS_ADVISORY_ACCURACY_METERS,
        batteryCritical:
          sample.battery.stateOfChargePercent < BATTERY_CRITICAL_PERCENT,
      },
    },
  }
}