import { StrictMode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TelemetrySample } from '../types/telemetry.types'
import { useTelemetry } from './useTelemetry'

const streamHarness = vi.hoisted(() => {
  const listeners = new Set<(sample: unknown) => void>()
  const source = {
    subscribe: vi.fn((listener: (sample: unknown) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
    start: vi.fn(),
    stop: vi.fn(),
    setScenario: vi.fn(),
  }

  return {
    source,
    createMockTelemetryStream: vi.fn(() => source),
    emit(sample: unknown) {
      for (const listener of [...listeners]) listener(sample)
    },
    listenerCount: () => listeners.size,
    clearListeners: () => listeners.clear(),
  }
})

vi.mock('../services/mockTelemetryStream', () => ({
  createMockTelemetryStream: streamHarness.createMockTelemetryStream,
}))

function createSample(sequenceNumber = 1): TelemetrySample {
  return {
    timestamp: Date.now(),
    sequenceNumber,
    gps: {
      latitude: 45.71,
      longitude: 31.09,
      accuracyMeters: 1.8,
      fixTimestamp: Date.now(),
    },
    pose: { yawDegrees: 156.2, pitchDegrees: 1.8, rollDegrees: -2.4 },
    battery: { stateOfChargePercent: 78, voltageVolts: 24.6, currentAmps: 4.2 },
  }
}

function emit(sample: unknown): void {
  act(() => streamHarness.emit(sample))
}

describe('useTelemetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'))
    streamHarness.clearListeners()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('subscribes, starts, and exposes processed telemetry', () => {
    const { result } = renderHook(() => useTelemetry())

    expect(result.current.status).toBe('offline')
    expect(result.current.telemetry).toBeNull()
    expect(streamHarness.source.start).toHaveBeenCalledTimes(1)

    emit(createSample())

    expect(result.current.vessel.id).toBe('usv-001')
    expect(result.current.status).toBe('normal')
    expect(result.current.telemetry?.batteryPowerWatts).toBeCloseTo(103.32)
    expect(result.current.lastUpdatedAt).toBe(Date.now())
  })

  it('ignores invalid, duplicate, and out-of-order samples', () => {
    const { result } = renderHook(() => useTelemetry())
    emit(createSample(2))
    const acceptedTelemetry = result.current.telemetry
    const acceptedAt = result.current.lastUpdatedAt

    act(() => vi.advanceTimersByTime(1_000))
    emit({ ...createSample(3), gps: { ...createSample(3).gps, latitude: 91 } })
    emit(createSample(1))
    emit(createSample(2))

    expect(result.current.telemetry).toBe(acceptedTelemetry)
    expect(result.current.lastUpdatedAt).toBe(acceptedAt)
    expect(result.current.status).toBe('normal')
  })

  it('drops a sample whose derived battery power is not finite and keeps the last valid telemetry', () => {
    const { result } = renderHook(() => useTelemetry())
    emit(createSample(2))
    const acceptedTelemetry = result.current.telemetry

    const overflowing = createSample(3)
    emit({ ...overflowing, battery: { ...overflowing.battery, voltageVolts: 1e200, currentAmps: 1e200 } })

    expect(result.current.telemetry).toBe(acceptedTelemetry)
    expect(result.current.status).toBe('normal')
  })

  it('marks stale data offline after more than three seconds and preserves it', () => {
    const { result } = renderHook(() => useTelemetry())
    emit(createSample())
    const acceptedTelemetry = result.current.telemetry
    const acceptedAt = result.current.lastUpdatedAt

    act(() => vi.advanceTimersByTime(3_000))
    expect(result.current.status).toBe('normal')
    act(() => vi.advanceTimersByTime(1))

    expect(result.current.status).toBe('offline')
    expect(result.current.telemetry).toBe(acceptedTelemetry)
    expect(result.current.lastUpdatedAt).toBe(acceptedAt)
  })

  it('remains offline after reconnect until a new valid sample arrives', () => {
    const { result } = renderHook(() => useTelemetry())
    emit(createSample(1))
    const acceptedTelemetry = result.current.telemetry

    act(() => result.current.reconnect())

    expect(result.current.status).toBe('offline')
    expect(result.current.telemetry).toBe(acceptedTelemetry)
    expect(streamHarness.source.stop).toHaveBeenCalledTimes(1)
    expect(streamHarness.source.start).toHaveBeenCalledTimes(2)

    emit(createSample(2))
    expect(result.current.status).toBe('normal')
    expect(result.current.telemetry?.sample.sequenceNumber).toBe(2)
  })

  it('cleans up the subscription and stale timer on unmount', () => {
    const { unmount } = renderHook(() => useTelemetry())
    emit(createSample())
    expect(streamHarness.listenerCount()).toBe(1)
    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(streamHarness.listenerCount()).toBe(0)
    expect(streamHarness.source.stop).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('survives the Strict Mode effect cleanup and setup cycle', () => {
    const { result, unmount } = renderHook(() => useTelemetry(), {
      wrapper: StrictMode,
    })

    expect(streamHarness.listenerCount()).toBe(1)
    expect(streamHarness.source.start).toHaveBeenCalledTimes(2)
    expect(streamHarness.source.stop).toHaveBeenCalledTimes(1)

    emit(createSample())
    expect(result.current.status).toBe('normal')

    unmount()
    expect(streamHarness.listenerCount()).toBe(0)
    expect(streamHarness.source.stop).toHaveBeenCalledTimes(2)
  })

  it('uses processor advisory priority and forwards scenario changes', () => {
    const { result } = renderHook(() => useTelemetry())
    act(() => result.current.setScenario('gps-advisory'))
    expect(streamHarness.source.setScenario).toHaveBeenCalledWith('gps-advisory')
    emit({
      ...createSample(),
      gps: { ...createSample().gps, accuracyMeters: 18.4 },
      battery: { ...createSample().battery, stateOfChargePercent: 9 },
    })

    expect(result.current.status).toBe('battery-critical')
  })

  it('does not mark the stream offline while GPS is frozen but samples keep arriving', () => {
    const { result } = renderHook(() => useTelemetry())
    const frozenFix = Date.now()

    for (let sequenceNumber = 1; sequenceNumber <= 6; sequenceNumber += 1) {
      emit({
        ...createSample(sequenceNumber),
        gps: { ...createSample(sequenceNumber).gps, fixTimestamp: frozenFix },
      })
      act(() => vi.advanceTimersByTime(1_000))
      expect(result.current.status).toBe('normal')
    }
  })

  it('transitions through telemetry thresholds and stays normal after recovery', () => {
    const { result } = renderHook(() => useTelemetry())

    emit(createSample(1))
    expect(result.current.status).toBe('normal')

    emit({
      ...createSample(2),
      gps: { ...createSample(2).gps, accuracyMeters: 18.4 },
    })
    expect(result.current.status).toBe('gps-advisory')

    emit({
      ...createSample(3),
      battery: { ...createSample(3).battery, stateOfChargePercent: 14.8 },
    })
    expect(result.current.status).toBe('battery-critical')

    for (let sequenceNumber = 4; sequenceNumber <= 8; sequenceNumber += 1) {
      act(() => vi.advanceTimersByTime(1_000))
      emit({
        ...createSample(sequenceNumber),
        battery: { ...createSample(sequenceNumber).battery, stateOfChargePercent: 15 },
      })
      expect(result.current.status).toBe('normal')
    }
  })
})