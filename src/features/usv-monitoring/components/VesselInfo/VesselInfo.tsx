import type { TelemetryStatus } from '../../hooks/useTelemetry'
import type { ProcessedTelemetry, VesselInfo as VesselInfoData } from '../../types/telemetry.types'
import {
  formatCoordinate,
  formatDegrees,
  formatPercent,
} from '../../utils/telemetryFormatting'
import styles from './VesselInfo.module.scss'

interface VesselInfoProps {
  vessel: VesselInfoData
  telemetry: ProcessedTelemetry | null
  status: TelemetryStatus
  gpsStale: boolean
  onViewDetails: () => void
}

export function VesselInfo({ vessel, telemetry, status, gpsStale, onViewDetails }: VesselInfoProps) {
  const sample = telemetry?.sample
  const accuracyLabel =
    status === 'offline'
      ? 'ACCURACY · STALE'
      : sample
        ? `ACCURACY · ${sample.gps.accuracyMeters.toFixed(1)} m`
        : 'ACCURACY · —'

  return (
    <aside className={styles.vesselInfo} aria-label="Vessel information">
      <p className={styles.vesselInfo__eyebrow}>SELECTED VESSEL</p>
      <h2 className={styles.vesselInfo__name}>{vessel.name}</h2>
      <p className={styles.vesselInfo__dimensions}>
        USV · {vessel.lengthMeters.toFixed(1)} × {vessel.widthMeters.toFixed(1)} m
      </p>
      {status === 'offline' && sample && (
        <p className={styles.vesselInfo__staleBadge}>LAST KNOWN · STALE</p>
      )}
      <GPSStatus
        telemetry={telemetry}
        status={status}
        gpsStale={gpsStale}
        accuracyLabel={accuracyLabel}
      />
      <PoseIndicator telemetry={telemetry} />
      <BatteryStatus telemetry={telemetry} status={status} />
      <button className={styles.vesselInfo__actionButton} onClick={onViewDetails}>
        VIEW DETAILS <span aria-hidden="true">→</span>
      </button>
    </aside>
  )
}

interface ReadingProps {
  telemetry: ProcessedTelemetry | null
}

interface GPSStatusProps extends ReadingProps {
  status: TelemetryStatus
  gpsStale: boolean
  accuracyLabel: string
}

function GPSStatus({ telemetry, status, gpsStale, accuracyLabel }: GPSStatusProps) {
  const gps = telemetry?.sample.gps
  return (
    <section className={styles.vesselInfo__metricGroup} aria-label="GPS position">
      <h3 className={styles.vesselInfo__eyebrow}>GPS / POSITION</h3>
      <p className={styles.vesselInfo__coordinate}>
        {gps ? formatCoordinate(gps.latitude, 'latitude') : '—'}
      </p>
      <p className={styles.vesselInfo__coordinate}>
        {gps ? formatCoordinate(gps.longitude, 'longitude') : '—'}
      </p>
      <p className={styles.vesselInfo__metricAccent} data-status={status}>
        {accuracyLabel}
        {gpsStale && <span className={styles.vesselInfo__staleFlag}> · STALE</span>}
      </p>
    </section>
  )
}

function PoseIndicator({ telemetry }: ReadingProps) {
  const pose = telemetry?.sample.pose
  return (
    <section className={styles.vesselInfo__metricGroup} aria-label="Vessel pose">
      <h3 className={styles.vesselInfo__eyebrow}>POSE</h3>
      <dl className={styles.vesselInfo__poseList}>
        <div className={styles.vesselInfo__poseItem}>
          <dt className={styles.vesselInfo__poseTerm}>YAW</dt>
          <dd className={styles.vesselInfo__poseValue}>{pose ? `${telemetry.normalizedYawDegrees.toFixed(1)}°` : '—'}</dd>
        </div>
        <div className={styles.vesselInfo__poseItem}>
          <dt className={styles.vesselInfo__poseTerm}>PITCH</dt>
          <dd className={styles.vesselInfo__poseValue}>{pose ? formatDegrees(pose.pitchDegrees) : '—'}</dd>
        </div>
        <div className={styles.vesselInfo__poseItem}>
          <dt className={styles.vesselInfo__poseTerm}>ROLL</dt>
          <dd className={styles.vesselInfo__poseValue}>{pose ? formatDegrees(pose.rollDegrees) : '—'}</dd>
        </div>
      </dl>
    </section>
  )
}

interface BatteryStatusProps extends ReadingProps {
  status: TelemetryStatus
}

function BatteryStatus({ telemetry, status }: BatteryStatusProps) {
  const battery = telemetry?.sample.battery
  return (
    <section className={styles.vesselInfo__metricGroup} aria-label="Battery status">
      <h3 className={styles.vesselInfo__eyebrow}>BATTERY</h3>
      <p className={styles.vesselInfo__charge} data-status={status}>
        <span>SOC</span>
        <strong>{battery ? formatPercent(battery.stateOfChargePercent) : '—'}</strong>
      </p>
      <p className={styles.vesselInfo__batteryLine}>
        VOLTAGE <span>{battery ? `${battery.voltageVolts.toFixed(1)} V` : '—'}</span>
      </p>
      <p className={styles.vesselInfo__batteryLine}>
        CURRENT <span>{battery ? `${battery.currentAmps.toFixed(1)} A` : '—'}</span>
      </p>
    </section>
  )
}
