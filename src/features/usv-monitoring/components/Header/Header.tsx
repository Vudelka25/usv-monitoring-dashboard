import type { ChangeEvent } from 'react'
import { logoAsset } from '../../../../assets'
import type { TelemetryStatus } from '../../hooks/useTelemetry'
import type { TelemetryScenario } from '../../types/telemetry.types'
import styles from './Header.module.scss'

const SCENARIO_OPTIONS: { value: TelemetryScenario; label: string }[] = [
  { value: 'normal', label: 'LIVE STREAM · 1 Hz' },
  { value: 'gps-advisory', label: 'GPS ADVISORY' },
  { value: 'battery-critical', label: 'BATTERY CRITICAL' },
  { value: 'offline', label: 'DISCONNECTED' },
]

interface HeaderProps {
  status: TelemetryStatus
  selectedScenario: TelemetryScenario
  onScenarioChange: (event: ChangeEvent<HTMLSelectElement>) => void
}

export function Header({ status, selectedScenario, onScenarioChange }: HeaderProps) {
  return (
    <header className={styles.header}>
      <img className={styles.header__logo} src={logoAsset} alt="DEMCON" />
      <p className={styles.header__productLabel}>USV TELEMETRY</p>
      <label className={styles.header__stream} data-status={status}>
        <span className={styles.header__visuallyHidden}>Telemetry mode</span>
        <select
          className={styles.header__select}
          value={selectedScenario}
          onChange={onScenarioChange}
        >
          {SCENARIO_OPTIONS.map((option) => (
            <option key={option.value} className={styles.header__option} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <span className={styles.header__authority}>HUMAN</span>
    </header>
  )
}
