import {
  USV_VESSEL,
  type TelemetrySample,
  type TelemetryScenario,
} from '../types/telemetry.types'

const EMISSION_INTERVAL_MS = 1_000
const VESSEL_SPEED_METERS_PER_SECOND = 5
const ROUTE_BEARING_DEGREES = 156.2

// GPS advisory demo: ramp up 15-19, hold 19-35, ramp down 35-39.
const GPS_ADVISORY_START_SEQUENCE = 15
const GPS_ADVISORY_PEAK_SEQUENCE = 19
const GPS_ADVISORY_RECOVERY_SEQUENCE = 35
const GPS_ADVISORY_END_SEQUENCE = 39
const GPS_ADVISORY_ACCURACY_METERS = 18.4

// Automatic scenario only: GPS fix is frozen (no new position) during these samples.
const GPS_FREEZE_START_SEQUENCE = 20
const GPS_FREEZE_END_SEQUENCE = 34

// Battery critical demo (accelerated): fall 50-56, hold to 69, restore 69-74.
const BATTERY_CRITICAL_START_SEQUENCE = 50
const BATTERY_CRITICAL_FLOOR_SEQUENCE = 56
const BATTERY_RECOVERY_START_SEQUENCE = 69
const BATTERY_RECOVERY_END_SEQUENCE = 74
const BATTERY_CRITICAL_FLOOR_PERCENT = 14
const BATTERY_RECOVERED_PERCENT = 16

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

// 0 is normal accuracy, 1 is the full advisory deterioration.
function getGpsAdvisoryProgress(sequence: number): number {
  if (sequence < GPS_ADVISORY_START_SEQUENCE || sequence > GPS_ADVISORY_END_SEQUENCE) {
    return 0
  }
  if (sequence < GPS_ADVISORY_PEAK_SEQUENCE) {
    const rampStart = GPS_ADVISORY_START_SEQUENCE - 1
    return (sequence - rampStart) / (GPS_ADVISORY_PEAK_SEQUENCE - rampStart)
  }
  if (sequence < GPS_ADVISORY_RECOVERY_SEQUENCE) {
    return 1
  }
  const rampStart = GPS_ADVISORY_RECOVERY_SEQUENCE - 1
  return (GPS_ADVISORY_END_SEQUENCE - sequence) / (GPS_ADVISORY_END_SEQUENCE - rampStart)
}

function getDemoStateOfCharge(sequence: number, normalPercent: number): number {
  if (sequence < BATTERY_CRITICAL_START_SEQUENCE) {
    return normalPercent
  }
  if (sequence > BATTERY_RECOVERY_END_SEQUENCE) {
    return BATTERY_RECOVERED_PERCENT
  }
  if (sequence <= BATTERY_CRITICAL_FLOOR_SEQUENCE) {
    const fallStart = BATTERY_CRITICAL_START_SEQUENCE - 1
    return interpolate(
      normalPercent,
      BATTERY_CRITICAL_FLOOR_PERCENT,
      (sequence - fallStart) / (BATTERY_CRITICAL_FLOOR_SEQUENCE - fallStart),
    )
  }
  if (sequence <= BATTERY_RECOVERY_START_SEQUENCE) {
    return BATTERY_CRITICAL_FLOOR_PERCENT
  }
  return interpolate(
    BATTERY_CRITICAL_FLOOR_PERCENT,
    BATTERY_RECOVERED_PERCENT,
    (sequence - BATTERY_RECOVERY_START_SEQUENCE) /
      (BATTERY_RECOVERY_END_SEQUENCE - BATTERY_RECOVERY_START_SEQUENCE),
  )
}

export interface MockTelemetryStreamOptions {
  random?: () => number
  now?: () => number
}

export interface MockTelemetryStream {
  subscribe(listener: (sample: TelemetrySample) => void): () => void
  start(): void
  stop(): void
  setScenario(scenario: TelemetryScenario): void
}

export function createMockTelemetryStream(
  options: MockTelemetryStreamOptions = {},
): MockTelemetryStream {
  const random = options.random ?? Math.random
  const now = options.now ?? Date.now
  const listeners = new Set<(sample: TelemetrySample) => void>()

  let scenario: TelemetryScenario = 'normal'
  let requestedRunning = false
  let intervalId: ReturnType<typeof setInterval> | undefined
  let sequenceNumber = 0
  let gpsFixTimestamp: number | undefined
  let gps = {
    latitude: USV_VESSEL.initialLatitude,
    longitude: USV_VESSEL.initialLongitude,
    accuracyMeters: 1.8,
  }
  let pose = { yawDegrees: 156.2, pitchDegrees: 1.8, rollDegrees: -2.4 }
  let battery = {
    stateOfChargePercent: 78,
    voltageVolts: 24.6,
    currentAmps: 4.2,
  }

  function randomStep(maximum: number): number {
    return (random() * 2 - 1) * maximum
  }

  function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value))
  }

  function advancePosition(sequence: number): void {
    const bearingDegrees = ROUTE_BEARING_DEGREES + Math.sin(sequence / 45) * 5
    const bearingRadians = (bearingDegrees * Math.PI) / 180
    const northMeters = VESSEL_SPEED_METERS_PER_SECOND * Math.cos(bearingRadians)
    const eastMeters = VESSEL_SPEED_METERS_PER_SECOND * Math.sin(bearingRadians)
    const latitudeRadians = (gps.latitude * Math.PI) / 180

    gps = {
      ...gps,
      latitude: gps.latitude + northMeters / 111_320,
      longitude:
        gps.longitude +
        eastMeters / (111_320 * Math.cos(latitudeRadians)),
    }
  }

  function createSample(): TelemetrySample {
    sequenceNumber += 1
    const timestamp = now()
    if (gpsFixTimestamp === undefined) gpsFixTimestamp = timestamp
    const gpsFrozen =
      scenario === 'gps-advisory' ||
      (scenario === 'normal' &&
        sequenceNumber >= GPS_FREEZE_START_SEQUENCE &&
        sequenceNumber <= GPS_FREEZE_END_SEQUENCE)
    if (!gpsFrozen) {
      advancePosition(sequenceNumber)
      gpsFixTimestamp = timestamp
    }

    gps = {
      latitude: gps.latitude,
      longitude: gps.longitude,
      accuracyMeters: clamp(
        gps.accuracyMeters + randomStep(0.35),
        0.5,
        8,
      ),
    }
    pose = {
      yawDegrees: (pose.yawDegrees + randomStep(1.5) + 360) % 360,
      pitchDegrees: clamp(pose.pitchDegrees + randomStep(0.4), -10, 10),
      rollDegrees: clamp(pose.rollDegrees + randomStep(0.4), -10, 10),
    }
    battery = {
      stateOfChargePercent: Math.max(0, battery.stateOfChargePercent - 0.005 - random() * 0.02),
      voltageVolts: clamp(battery.voltageVolts + randomStep(0.08), 23.5, 25.5),
      currentAmps: clamp(battery.currentAmps + randomStep(0.12), 3.2, 5.5),
    }

    const simulatedAccuracyMeters = interpolate(
      gps.accuracyMeters,
      GPS_ADVISORY_ACCURACY_METERS,
      getGpsAdvisoryProgress(sequenceNumber),
    )
    const simulatedStateOfCharge = getDemoStateOfCharge(
      sequenceNumber,
      battery.stateOfChargePercent,
    )

    return {
      timestamp,
      sequenceNumber,
      gps: {
        ...gps,
        fixTimestamp: gpsFixTimestamp,
        accuracyMeters:
          scenario === 'gps-advisory'
            ? GPS_ADVISORY_ACCURACY_METERS
            : scenario === 'normal'
              ? simulatedAccuracyMeters
              : gps.accuracyMeters,
      },
      pose: { ...pose },
      battery: {
        ...battery,
        stateOfChargePercent:
          scenario === 'battery-critical'
            ? 9
            : scenario === 'normal'
              ? simulatedStateOfCharge
              : battery.stateOfChargePercent,
      },
    }
  }

  function emit(): void {
    const sample = createSample()
    for (const listener of [...listeners]) {
      listener(sample)
    }
  }

  function ensureInterval(): void {
    if (requestedRunning && scenario !== 'offline' && intervalId === undefined) {
      intervalId = setInterval(emit, EMISSION_INTERVAL_MS)
    }
  }

  function clearIntervalIfRunning(): void {
    if (intervalId !== undefined) {
      clearInterval(intervalId)
      intervalId = undefined
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start() {
      requestedRunning = true
      ensureInterval()
    },
    stop() {
      requestedRunning = false
      clearIntervalIfRunning()
    },
    setScenario(nextScenario) {
      scenario = nextScenario
      if (scenario === 'offline') {
        clearIntervalIfRunning()
      } else {
        ensureInterval()
      }
    },
  }
}