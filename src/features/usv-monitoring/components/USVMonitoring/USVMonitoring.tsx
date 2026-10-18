import { useState, type ChangeEvent } from 'react'
import { useNow } from '../../hooks/useNow'
import { useTelemetry } from '../../hooks/useTelemetry'
import { isGpsStale } from '../../services/telemetryProcessor'
import type { TelemetryScenario } from '../../types/telemetry.types'
import { formatAge } from '../../utils/telemetryFormatting'
import { ConnectionStatus } from '../ConnectionStatus'
import { DetailsPanel, type DetailsView } from '../DetailsPanel'
import { Header } from '../Header'
import styles from './USVMonitoring.module.scss'
import { VesselInfo } from '../VesselInfo'
import { VesselMap } from '../VesselMap'

export function USVMonitoring() {
  const {
    vessel,
    telemetry,
    status,
    lastUpdatedAt,
    reconnect,
    setScenario,
  } = useTelemetry()
  const [detailsView, setDetailsView] = useState<DetailsView>('overview')
  const [selectedScenario, setSelectedScenario] = useState<TelemetryScenario>(
    'normal',
  )
  const now = useNow()
  const age = lastUpdatedAt === null ? null : formatAge(lastUpdatedAt, now)
  const gpsFix = telemetry?.sample.gps.fixTimestamp ?? null
  const gpsClock = telemetry ? Math.max(now, telemetry.sample.timestamp) : now
  const gpsAge = gpsFix === null ? null : formatAge(gpsFix, gpsClock)
  const gpsStale =
    gpsFix !== null && status !== 'offline' && isGpsStale(gpsFix, gpsClock)

  function handleScenarioChange(event: ChangeEvent<HTMLSelectElement>): void {
    const scenario = event.currentTarget.value as TelemetryScenario
    setSelectedScenario(scenario)
    setScenario(scenario)
  }

  function handleReconnect(): void {
    if (selectedScenario === 'offline') {
      setSelectedScenario('normal')
      setScenario('normal')
    }
    reconnect()
  }

  return (
    <main className={styles.usvMonitoring}>
      <Header
        status={status}
        selectedScenario={selectedScenario}
        onScenarioChange={handleScenarioChange}
      />
      <ConnectionStatus
        status={status}
        telemetry={telemetry}
        age={age}
        detailsOpen={detailsView !== 'overview'}
      />
      <div className={styles.usvMonitoring__workspace}>
        <VesselInfo
          vessel={vessel}
          telemetry={telemetry}
          status={status}
          gpsStale={gpsStale}
          onViewDetails={() => setDetailsView('gps')}
        />
        <VesselMap
          vessel={vessel}
          status={status}
          telemetry={telemetry}
          gpsAge={gpsAge}
          gpsStale={gpsStale}
        />
        <DetailsPanel
          view={detailsView}
          status={status}
          telemetry={telemetry}
          age={age}
          gpsAge={gpsAge}
          gpsStale={gpsStale}
          onViewChange={setDetailsView}
          onReconnect={handleReconnect}
        />
      </div>
    </main>
  )
}
