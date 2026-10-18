import { useEffect, useRef, useState } from 'react'
import { createMockTelemetryStream } from '../services/mockTelemetryStream'
import { processTelemetrySample } from '../services/telemetryProcessor'
import {
  USV_VESSEL,
  type ProcessedTelemetry,
  type TelemetryScenario,
  type VesselInfo,
} from '../types/telemetry.types'

const STALE_AFTER_MS = 3_000

export type TelemetryStatus =
  | 'offline'
  | 'battery-critical'
  | 'gps-advisory'
  | 'normal'

interface TelemetryState {
  telemetry: ProcessedTelemetry | null
  lastUpdatedAt: number | null
  live: boolean
}

export interface UseTelemetryResult {
  vessel: VesselInfo
  telemetry: ProcessedTelemetry | null
  status: TelemetryStatus
  lastUpdatedAt: number | null
  reconnect: () => void
  setScenario: (scenario: TelemetryScenario) => void
}

export function useTelemetry(): UseTelemetryResult {
  const [source] = useState(() => createMockTelemetryStream())
  const [state, setState] = useState<TelemetryState>({
    telemetry: null,
    lastUpdatedAt: null,
    live: false,
  })
  const lastSequenceRef = useRef(0)
  const lastReceivedAtRef = useRef<number | null>(null)
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scenarioRef = useRef<TelemetryScenario>('normal')

  useEffect(() => {
    const clearStaleTimer = () => {
      if (staleTimerRef.current !== null) {
        clearTimeout(staleTimerRef.current)
        staleTimerRef.current = null
      }
    }

    const unsubscribe = source.subscribe((sample) => {
      const result = processTelemetrySample(sample)
      if (!result.valid) return

      const sequenceNumber = result.telemetry.sample.sequenceNumber
      if (sequenceNumber <= lastSequenceRef.current) return

      lastSequenceRef.current = sequenceNumber
      const receivedAt = Date.now()
      lastReceivedAtRef.current = receivedAt
      setState({
        telemetry: result.telemetry,
        lastUpdatedAt: receivedAt,
        live: true,
      })

      clearStaleTimer()
      staleTimerRef.current = setTimeout(() => {
        const lastReceivedAt = lastReceivedAtRef.current
        if (
          lastReceivedAt !== null &&
          Date.now() - lastReceivedAt > STALE_AFTER_MS
        ) {
          setState((current) =>
            current.live ? { ...current, live: false } : current,
          )
        }
      }, STALE_AFTER_MS + 1)
    })

    source.start()

    return () => {
      unsubscribe()
      source.stop()
      clearStaleTimer()
    }
  }, [source])

  function reconnect(): void {
    if (staleTimerRef.current !== null) {
      clearTimeout(staleTimerRef.current)
      staleTimerRef.current = null
    }
    setState((current) => (current.live ? { ...current, live: false } : current))
    source.stop()
    if (scenarioRef.current === 'offline') {
      scenarioRef.current = 'normal'
      source.setScenario('normal')
    }
    source.start()
  }

  function setScenario(scenario: TelemetryScenario): void {
    scenarioRef.current = scenario
    source.setScenario(scenario)
  }

  let status: TelemetryStatus = 'offline'
  if (state.live && state.telemetry !== null) {
    if (state.telemetry.advisories.batteryCritical) {
      status = 'battery-critical'
    } else if (state.telemetry.advisories.gpsAccuracy) {
      status = 'gps-advisory'
    } else {
      status = 'normal'
    }
  }

  return {
    vessel: USV_VESSEL,
    telemetry: state.telemetry,
    status,
    lastUpdatedAt: state.lastUpdatedAt,
    reconnect,
    setScenario,
  }
}