import { MapContainer, TileLayer } from 'react-leaflet'
import type { TelemetryStatus } from '../../hooks/useTelemetry'
import type { ProcessedTelemetry, VesselInfo } from '../../types/telemetry.types'
import { ErrorBoundary } from '../ErrorBoundary'
import { ErrorFallback } from '../ErrorFallback'
import { MapZoomControls } from '../MapZoomControls'
import styles from './VesselMap.module.scss'
import { VesselMarker } from '../VesselMarker'

interface ReadingProps {
  telemetry: ProcessedTelemetry | null
}

interface VesselMapProps extends ReadingProps {
  vessel: VesselInfo
  status: TelemetryStatus
  gpsAge: string | null
  gpsStale: boolean
}

export function VesselMap({ vessel, status, telemetry, gpsAge, gpsStale }: VesselMapProps) {

  return (
    <figure className={styles.vesselMap} aria-label="USV geographic map">
      <ErrorBoundary
        fallback={(reset) => (
          <ErrorFallback
            className={styles.vesselMap__fallback}
            message="The map could not be displayed."
            onRetry={reset}
          />
        )}
      >
        <MapContainer
          className={styles.vesselMap__container}
          center={[vessel.initialLatitude, vessel.initialLongitude]}
          zoom={16}
          minZoom={3}
          scrollWheelZoom
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapZoomControls />
          {telemetry && (
            <VesselMarker
              vessel={vessel}
              status={status}
              telemetry={telemetry}
              age={gpsAge}
              gpsStale={gpsStale}
            />
          )}
        </MapContainer>
      </ErrorBoundary>
    </figure>
  )
}
