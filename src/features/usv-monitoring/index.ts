export { USVMonitoring } from './components/USVMonitoring'
export { ErrorBoundary } from './components/ErrorBoundary'
export { ErrorFallback } from './components/ErrorFallback'
export { useTelemetry } from './hooks/useTelemetry'
export type {
	TelemetryStatus,
	UseTelemetryResult,
} from './hooks/useTelemetry'
export { createMockTelemetryStream } from './services/mockTelemetryStream'
export type {
	MockTelemetryStream,
	MockTelemetryStreamOptions,
} from './services/mockTelemetryStream'
export {
	processTelemetrySample,
	validateTelemetrySample,
} from './services/telemetryProcessor'
export { USV_VESSEL } from './types/telemetry.types'
export type {
	BatteryReading,
	GPSReading,
	ProcessedTelemetry,
	TelemetryProcessingResult,
	TelemetrySample,
	TelemetryScenario,
	TelemetryValidationResult,
	VesselInfo,
	VesselPose,
} from './types/telemetry.types'