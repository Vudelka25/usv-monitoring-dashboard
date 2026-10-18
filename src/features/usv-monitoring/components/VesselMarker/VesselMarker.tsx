import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { Marker, Popup, useMap } from 'react-leaflet'
import {
  criticalMarker,
  degradedMarker,
  lastKnownMarker,
  liveMarker,
} from '../../../../assets'
import type { TelemetryStatus } from '../../hooks/useTelemetry'
import type { ProcessedTelemetry, VesselInfo } from '../../types/telemetry.types'
import { formatCoordinate } from '../../utils/telemetryFormatting'
import styles from './VesselMarker.module.scss'

function createVesselIcon(iconUrl: string): L.Icon {
  return L.icon({
    iconUrl,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
    className: styles.vesselMarker__icon,
  })
}

const VESSEL_MARKER_ICONS: Record<TelemetryStatus, L.Icon> = {
  normal: createVesselIcon(liveMarker),
  'gps-advisory': createVesselIcon(degradedMarker),
  'battery-critical': createVesselIcon(criticalMarker),
  offline: createVesselIcon(lastKnownMarker),
}

const MARKER_ANIMATION_DURATION_MS = 900

interface VesselMarkerProps {
  vessel: VesselInfo
  status: TelemetryStatus
  telemetry: ProcessedTelemetry
  age: string | null
  gpsStale: boolean
}

export function VesselMarker({ vessel, status, telemetry, age, gpsStale }: VesselMarkerProps) {
  const { latitude, longitude, accuracyMeters } = telemetry.sample.gps
  const lastKnown = status === 'offline' || gpsStale
  const hasValidPosition =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  const markerRef = useRef<L.Marker>(null)
  const [initialPosition] = useState<[number, number]>(() => [latitude, longitude])
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!hasValidPosition) return

    const marker = markerRef.current
    if (!marker) return

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    const start = marker.getLatLng()
    const latitudeDelta = latitude - start.lat
    const longitudeDelta = longitude - start.lng
    if (latitudeDelta === 0 && longitudeDelta === 0) return

    let startTime: number | null = null

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / MARKER_ANIMATION_DURATION_MS, 1)
      marker.setLatLng([
        start.lat + latitudeDelta * progress,
        start.lng + longitudeDelta * progress,
      ])

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        animationFrameRef.current = null
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [hasValidPosition, latitude, longitude])

  return (
    <Marker ref={markerRef} position={initialPosition} icon={VESSEL_MARKER_ICONS[status]}>
      <Popup className={styles.vesselMarker} closeButton={false}>
        <div className={styles.vesselMarker__card}>
          <PopupCloseButton />
          <div className={styles.vesselMarker__name}>{vessel.name}</div>
          <div className={styles.vesselMarker__coordinates}>
            {`${formatCoordinate(latitude, 'latitude')} / ${formatCoordinate(longitude, 'longitude')}`}
          </div>
          <div className={styles.vesselMarker__accuracy}>
            {`GPS accuracy ±${accuracyMeters.toFixed(1)} m`}
          </div>
          <div
            className={styles.vesselMarker__freshness}
            data-state={lastKnown ? 'last-known' : 'fresh'}
          >
            {`${lastKnown ? 'Last known' : 'Fresh'} · ${age ?? '—'}`}
          </div>
          <svg
            className={styles.vesselMarker__arrow}
            width="22"
            height="14"
            viewBox="0 0 22 14"
            aria-hidden="true"
          >
            <path className={styles.vesselMarker__arrowPath} d="M1 0 L11 12 L21 0" />
          </svg>
        </div>
      </Popup>
    </Marker>
  )
}

function PopupCloseButton() {
  const map = useMap()

  return (
    <button
      type="button"
      className={styles.vesselMarker__close}
      aria-label="Close vessel information"
      onClick={() => map.closePopup()}
    >
      <span aria-hidden="true">×</span>
    </button>
  )
}
