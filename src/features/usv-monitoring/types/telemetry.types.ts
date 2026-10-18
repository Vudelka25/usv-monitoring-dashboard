export interface VesselInfo {
  id: string
  name: string
  lengthMeters: number
  widthMeters: number
  initialLatitude: number
  initialLongitude: number
}

export const USV_VESSEL: VesselInfo = {
  id: 'usv-001',
  name: 'MV SENTINEL',
  lengthMeters: 5.8,
  widthMeters: 2.1,
  initialLatitude: 45.71,
  initialLongitude: 31.09,
}

export interface GPSReading {
  latitude: number
  longitude: number
  accuracyMeters: number
  /** Time of the last valid GPS fix; older than the sample timestamp when GPS is stale. */
  fixTimestamp: number
}

export interface VesselPose {
  yawDegrees: number
  pitchDegrees: number
  rollDegrees: number
}

export interface BatteryReading {
  stateOfChargePercent: number
  voltageVolts: number
  currentAmps: number
}

export interface TelemetrySample {
  timestamp: number
  sequenceNumber: number
  gps: GPSReading
  pose: VesselPose
  battery: BatteryReading
}

export type TelemetryScenario =
  | 'normal'
  | 'gps-advisory'
  | 'battery-critical'
  | 'offline'

export interface ProcessedTelemetry {
  sample: TelemetrySample
  normalizedYawDegrees: number
  batteryPowerWatts: number
  advisories: {
    gpsAccuracy: boolean
    batteryCritical: boolean
  }
}

export type TelemetryValidationResult =
  | { valid: true; sample: TelemetrySample }
  | { valid: false; errors: string[] }

export type TelemetryProcessingResult =
  | { valid: true; telemetry: ProcessedTelemetry }
  | { valid: false; errors: string[] }