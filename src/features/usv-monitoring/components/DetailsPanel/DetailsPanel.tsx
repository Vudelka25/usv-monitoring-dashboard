import type { TelemetryStatus } from '../../hooks/useTelemetry'
import type { ProcessedTelemetry } from '../../types/telemetry.types'
import {
  formatCoordinate,
  formatDegrees,
  formatPercent,
} from '../../utils/telemetryFormatting'
import styles from './DetailsPanel.module.scss'

export type DetailsView = 'overview' | 'gps' | 'battery'

interface ReadingProps {
  telemetry: ProcessedTelemetry | null
}

interface DetailsPanelProps extends ReadingProps {
  view: DetailsView
  status: TelemetryStatus
  age: string | null
  gpsAge: string | null
  gpsStale: boolean
  onViewChange: (view: DetailsView) => void
  onReconnect: () => void
}

export function DetailsPanel({
  view,
  status,
  telemetry,
  age,
  gpsAge,
  gpsStale,
  onViewChange,
  onReconnect,
}: DetailsPanelProps) {
  const effectiveView =
    status === 'offline' || status === 'battery-critical' ? 'overview' : view

  if (effectiveView === 'gps') {
    return (
      <aside className={styles.detailsPanel} aria-label="GPS and pose details">
        <h2 className={styles.detailsPanel__title} data-status={status}>GPS &amp; POSE · EXPANDED</h2>
        <p className={styles.detailsPanel__label}>GPS STATUS</p>
        <p className={styles.detailsPanel__value}>
          {telemetry
            ? `${formatCoordinate(telemetry.sample.gps.latitude, 'latitude')} / ${formatCoordinate(telemetry.sample.gps.longitude, 'longitude')}`
            : 'Position unavailable'}
        </p>
        <p className={styles.detailsPanel__value}>
          Horizontal accuracy {telemetry ? `±${telemetry.sample.gps.accuracyMeters.toFixed(1)} m` : '—'}
        </p>
        <p className={styles.detailsPanel__value}>
          YAW {telemetry ? `${telemetry.normalizedYawDegrees.toFixed(1)}°` : '—'}
          {'   '}PITCH {telemetry ? formatDegrees(telemetry.sample.pose.pitchDegrees) : '—'}
        </p>
        <p className={styles.detailsPanel__value}>
          ROLL {telemetry ? formatDegrees(telemetry.sample.pose.rollDegrees) : '—'}
        </p>
        <p className={styles.detailsPanel__freshness} data-status={status} data-gps-stale={gpsStale}>
          {status === 'offline'
            ? `Last known · ${age ?? 'no fix'}`
            : gpsStale
              ? `Last known GPS fix · ${gpsAge ?? 'no fix'}`
              : `GPS fix · ${gpsAge ?? 'waiting'}`}
        </p>
        <button className={styles.detailsPanel__actionButton} onClick={() => onViewChange('overview')}>
          CLOSE DETAILS <span aria-hidden="true">×</span>
        </button>
      </aside>
    )
  }

  if (effectiveView === 'battery') {
    return (
      <aside className={styles.detailsPanel} aria-label="Battery details">
        <BatteryDetails status={status} telemetry={telemetry} onClose={() => onViewChange('overview')} />
      </aside>
    )
  }

  if (status === 'battery-critical') {
    return (
      <aside className={styles.detailsPanel} aria-label="Critical battery status">
        <BatteryDetails status={status} telemetry={telemetry} />
      </aside>
    )
  }

  if (status === 'gps-advisory') {
    return (
      <aside className={styles.detailsPanel} aria-label="GPS quality advisory">
        <h2 className={styles.detailsPanel__title} data-status={status}>GPS QUALITY · EVIDENCE</h2>
        <p className={styles.detailsPanel__emphasis} data-status={status}>
          Measured accuracy {telemetry?.sample.gps.accuracyMeters.toFixed(1) ?? '—'} m
        </p>
        <p className={styles.detailsPanel__value}>Advisory threshold 10 m</p>
        <p className={styles.detailsPanel__value}>Position uncertainty increased</p>
        <h3 className={styles.detailsPanel__eyebrow}>RECOMMENDED</h3>
        <p className={styles.detailsPanel__value}>Verify position before route changes.</p>
        <p className={styles.detailsPanel__freshness} data-gps-stale={gpsStale}>
          {gpsStale ? 'Last known GPS fix' : 'GPS fix'} · {gpsAge ?? 'waiting'}
        </p>
        <button className={styles.detailsPanel__actionButton} onClick={() => onViewChange('gps')}>
          OPEN GPS EVIDENCE
        </button>
      </aside>
    )
  }

  if (status === 'offline') {
    return (
      <aside className={styles.detailsPanel} aria-label="Data quality and recovery">
        <h2 className={styles.detailsPanel__title} data-status={status}>DATA QUALITY / RECOVERY</h2>
        <p className={styles.detailsPanel__label} data-status={status}>
          {telemetry ? 'STREAM DISCONNECTED' : 'WAITING FOR TELEMETRY'}
        </p>
        <p className={styles.detailsPanel__value}>Last telemetry {age ?? 'not yet received'}</p>
        <p className={styles.detailsPanel__staleText}>GPS / pose / battery values STALE</p>
        <p className={styles.detailsPanel__value}>
          {telemetry ? 'Position is last known, not live.' : 'No valid position is available yet.'}
        </p>
        <h3 className={styles.detailsPanel__eyebrow}>RECOMMENDED ACTION</h3>
        <p className={styles.detailsPanel__value}>Reconnect and refresh snapshot.</p>
        <button className={styles.detailsPanel__actionButton} onClick={onReconnect}>
          RECONNECT STREAM
        </button>
        <p className={styles.detailsPanel__freshness}>Status: waiting for reconnect</p>
      </aside>
    )
  }

  return (
    <aside className={styles.detailsPanel} aria-label="Live telemetry overview">
      <h2 className={styles.detailsPanel__title} data-status={status}>LIVE DATA / QUICK VIEW</h2>
      <p className={styles.detailsPanel__summaryValue}>
        GPS {telemetry ? `${telemetry.sample.gps.accuracyMeters.toFixed(1)} m` : '—'} · {gpsStale ? 'LAST KNOWN' : 'FRESH'} {gpsAge ?? '—'}
      </p>
      <p className={styles.detailsPanel__value}>
        Pose stable · {telemetry ? `${telemetry.normalizedYawDegrees.toFixed(1)}° yaw` : '—'}
      </p>
      <p className={styles.detailsPanel__value}>
        Battery {telemetry ? formatPercent(telemetry.sample.battery.stateOfChargePercent) : '—'} · {telemetry ? `${telemetry.sample.battery.voltageVolts.toFixed(1)} V` : '—'}
      </p>
      <p className={styles.detailsPanel__helperText}>Select GPS, Pose or Battery to inspect</p>
      <button className={styles.detailsPanel__actionButton} onClick={() => onViewChange('gps')}>
        GPS &amp; POSE DETAILS <span aria-hidden="true">→</span>
      </button>
      <button className={styles.detailsPanel__actionButton} onClick={() => onViewChange('battery')}>
        BATTERY DETAILS <span aria-hidden="true">→</span>
      </button>
    </aside>
  )
}

interface BatteryDetailsProps extends ReadingProps {
  status: TelemetryStatus
  onClose?: () => void
}

function BatteryDetails({ status, telemetry, onClose }: BatteryDetailsProps) {
  const battery = telemetry?.sample.battery
  const critical = status === 'battery-critical'

  return (
    <>
      <h2 className={styles.detailsPanel__title} data-status={status}>
        {critical ? 'ACTIVE CRITICAL INCIDENT' : 'BATTERY · TELEMETRY'}
      </h2>
      {critical && <p className={styles.detailsPanel__label} data-status={status}>THREAT · LOW BATTERY</p>}
      <p className={styles.detailsPanel__summaryValue}>
        SOC {battery ? formatPercent(battery.stateOfChargePercent) : '—'} · threshold 15%
      </p>
      <p className={styles.detailsPanel__value}>
        Voltage {battery ? `${battery.voltageVolts.toFixed(1)} V` : '—'}
      </p>
      <p className={styles.detailsPanel__value}>
        Current {battery ? `${battery.currentAmps.toFixed(1)} A` : '—'} · Power {telemetry ? `${telemetry.batteryPowerWatts.toFixed(1)} W` : '—'}
      </p>
      {critical && <p className={styles.detailsPanel__consequence}>CONSEQUENCE · reduced endurance</p>}
      <h3 className={styles.detailsPanel__eyebrow}>{critical ? 'RECOMMENDED ACTION' : 'BATTERY STATE'}</h3>
      <p className={styles.detailsPanel__value}>
        {critical ? 'Review return / recovery plan.' : 'Battery readings are simulated.'}
      </p>
      {onClose && (
        <button className={styles.detailsPanel__actionButton} onClick={onClose}>
          CLOSE DETAILS <span aria-hidden="true">×</span>
        </button>
      )}
    </>
  )
}
