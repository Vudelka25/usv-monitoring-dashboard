import {
  advisoryStateIcon,
  criticalStateIcon,
  normalStateIcon,
  offlineStateIcon,
} from '../../../../assets'
import type { TelemetryStatus } from '../../hooks/useTelemetry'
import type { ProcessedTelemetry } from '../../types/telemetry.types'
import { formatPercent } from '../../utils/telemetryFormatting'
import styles from './ConnectionStatus.module.scss'

const STATE_ICONS: Record<TelemetryStatus, string> = {
  normal: normalStateIcon,
  'gps-advisory': advisoryStateIcon,
  'battery-critical': criticalStateIcon,
  offline: offlineStateIcon,
}

interface ConnectionStatusProps {
  status: TelemetryStatus
  telemetry: ProcessedTelemetry | null
  age: string | null
  detailsOpen: boolean
}

export function ConnectionStatus({
  status,
  telemetry,
  age,
  detailsOpen,
}: ConnectionStatusProps) {
  const banner = getBannerCopy(status, telemetry, age, detailsOpen)

  return (
    <section
      className={styles.connectionStatus}
      data-status={status}
      aria-live="polite"
      aria-atomic="true"
    >
      <img className={styles.connectionStatus__icon} src={STATE_ICONS[status]} alt="" />
      <div className={styles.connectionStatus__copy}>
        <div className={styles.connectionStatus__heading}>
          {banner.category && <span className={styles.connectionStatus__category}>{banner.category}</span>}
          <h1 className={styles.connectionStatus__title}>{banner.title}</h1>
        </div>
        <p className={styles.connectionStatus__description}>{banner.description}</p>
      </div>
    </section>
  )
}

function getBannerCopy(
  status: TelemetryStatus,
  telemetry: ProcessedTelemetry | null,
  age: string | null,
  detailsOpen: boolean,
): { title: string; description: string; category?: string } {
  if (status === 'offline') {
    return telemetry
      ? { title: 'LINK LOST · TELEMETRY STALE', description: `Last update ${age} · position not live` }
      : { title: 'CONNECTING · AWAITING TELEMETRY', description: 'Waiting for telemetry data' }
  }
  if (status === 'battery-critical') {
    return {
      category: 'CRITICAL',
      title: `LOW BATTERY · ${telemetry ? 'MV SENTINEL' : 'USV'}`,
      description: `SOC ${formatPercent(telemetry?.sample.battery.stateOfChargePercent ?? 0)} · threshold 15% · action required`,
    }
  }
  if (status === 'gps-advisory') {
    return {
      title: 'ADVISORY · GPS ACCURACY DEGRADED',
      description: `Accuracy ${telemetry?.sample.gps.accuracyMeters.toFixed(1) ?? '—'} m · threshold 10 m · verify position`,
    }
  }
  return detailsOpen
    ? { title: 'NORMAL · NAVIGATION DETAILS', description: 'Selected vessel · Position and GPS status' }
    : { title: 'NORMAL · USV ONLINE', description: 'Telemetry updates every 1s' }
}
