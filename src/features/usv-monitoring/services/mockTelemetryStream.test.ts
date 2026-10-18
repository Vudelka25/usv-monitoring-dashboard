import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  TelemetryProcessingResult,
  TelemetrySample,
} from '../types/telemetry.types'
import { createMockTelemetryStream } from './mockTelemetryStream'
import { processTelemetrySample } from './telemetryProcessor'

describe('createMockTelemetryStream', () => {
  function distanceMeters(
    from: TelemetrySample['gps'],
    to: TelemetrySample['gps'],
  ): number {
    const averageLatitudeRadians = ((from.latitude + to.latitude) / 2) * (Math.PI / 180)
    const northMeters = (to.latitude - from.latitude) * 111_320
    const eastMeters =
      (to.longitude - from.longitude) * 111_320 * Math.cos(averageLatitudeRadians)
    return Math.hypot(northMeters, eastMeters)
  }
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits one sample every 1000 ms', () => {
    const listener = vi.fn()
    const stream = createMockTelemetryStream()
    stream.subscribe(listener)
    stream.start()

    vi.advanceTimersByTime(999)
    expect(listener).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(listener).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2_000)
    expect(listener).toHaveBeenCalledTimes(3)
    stream.stop()
  })

  it('supports unsubscribe', () => {
    const listener = vi.fn()
    const stream = createMockTelemetryStream()
    const unsubscribe = stream.subscribe(listener)
    unsubscribe()
    stream.start()
    vi.advanceTimersByTime(1_000)

    expect(listener).not.toHaveBeenCalled()
    stream.stop()
  })

  it('does not create duplicate intervals when start is repeated', () => {
    const listener = vi.fn()
    const stream = createMockTelemetryStream()
    stream.subscribe(listener)
    stream.start()
    stream.start()
    vi.advanceTimersByTime(1_000)

    expect(listener).toHaveBeenCalledTimes(1)
    stream.stop()
  })

  it('stops and can restart after cleanup', () => {
    const listener = vi.fn()
    const stream = createMockTelemetryStream()
    stream.subscribe(listener)
    stream.start()
    vi.advanceTimersByTime(1_000)
    stream.stop()
    vi.advanceTimersByTime(2_000)
    expect(listener).toHaveBeenCalledTimes(1)

    stream.start()
    vi.advanceTimersByTime(1_000)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener.mock.calls[1][0].sequenceNumber).toBe(2)
    stream.stop()
  })

  it('moves gradually from the previous coordinates and varies readings', () => {
    const samples: TelemetrySample[] = []
    const stream = createMockTelemetryStream({ random: () => 0.75 })
    stream.subscribe((sample) => samples.push(sample))
    stream.start()
    vi.advanceTimersByTime(2_000)
    stream.stop()

    expect(samples).toHaveLength(2)
    expect(samples[0].gps.latitude).toBeLessThan(45.71)
    expect(samples[1].gps.latitude).toBeLessThan(samples[0].gps.latitude)
    expect(samples[0].gps.latitude - samples[1].gps.latitude).toBeLessThan(0.0001)
    expect(samples[1].gps.longitude).toBeGreaterThan(samples[0].gps.longitude)
    expect(samples[1].pose.yawDegrees).toBeGreaterThan(samples[0].pose.yawDegrees)
    expect(samples[1].pose.pitchDegrees).toBeGreaterThan(samples[0].pose.pitchDegrees)
    expect(samples[1].pose.rollDegrees).toBeGreaterThan(samples[0].pose.rollDegrees)
    expect(samples[1].gps.accuracyMeters).toBeGreaterThan(samples[0].gps.accuracyMeters)
    expect(samples[1].battery.stateOfChargePercent).toBeLessThan(
      samples[0].battery.stateOfChargePercent,
    )
    expect(samples[1].battery.voltageVolts).toBeGreaterThan(
      samples[0].battery.voltageVolts,
    )
    expect(samples[1].battery.currentAmps).toBeGreaterThan(
      samples[0].battery.currentAmps,
    )
  })

  it('moves along a deterministic route at the configured speed', () => {
    const samples: TelemetrySample[] = []
    const stream = createMockTelemetryStream({ random: () => 0.5 })
    stream.subscribe((sample) => samples.push(sample))
    stream.start()
    vi.advanceTimersByTime(4_000)
    stream.stop()

    const positions = [
      {
        latitude: 45.71,
        longitude: 31.09,
      },
      ...samples.map(({ gps }) => gps),
    ]
    const distancesMeters = positions.slice(1).map((position, index) => {
      const previousPosition = positions[index]
      const averageLatitudeRadians =
        ((position.latitude + previousPosition.latitude) / 2) * (Math.PI / 180)
      const northMeters = (position.latitude - previousPosition.latitude) * 111_320
      const eastMeters =
        (position.longitude - previousPosition.longitude) *
        111_320 *
        Math.cos(averageLatitudeRadians)
      return Math.hypot(northMeters, eastMeters)
    })

    expect(distancesMeters).toHaveLength(4)
    for (const distanceMeters of distancesMeters) {
      expect(distanceMeters).toBeCloseTo(5, 2)
    }
  })

  function collectSamples(count: number): TelemetrySample[] {
    const samples: TelemetrySample[] = []
    const stream = createMockTelemetryStream({ random: () => 0.5 })
    stream.subscribe((sample) => samples.push(sample))
    stream.start()
    vi.advanceTimersByTime(count * 1_000)
    stream.stop()
    return samples
  }

  function getStatuses(samples: TelemetrySample[]): string[] {
    return samples.map((sample) => {
      const result = processTelemetrySample(sample)
      if (!result.valid) throw new Error(result.errors.join(', '))
      if (result.telemetry.advisories.batteryCritical) return 'critical'
      if (result.telemetry.advisories.gpsAccuracy) return 'warning'
      return 'normal'
    })
  }

  it('deteriorates and recovers GPS accuracy gradually during samples 15-39', () => {
    const accuracy = collectSamples(45).map((sample) => sample.gps.accuracyMeters)
    const at = (sequence: number) => accuracy[sequence - 1]

    for (let sequence = 1; sequence <= 14; sequence += 1) {
      expect(at(sequence)).toBeCloseTo(1.8, 5)
    }
    expect(at(15)).toBeGreaterThan(1.8)
    expect(at(15)).toBeLessThan(10)
    for (let sequence = 15; sequence < 19; sequence += 1) {
      expect(at(sequence + 1)).toBeGreaterThan(at(sequence))
    }
    for (let sequence = 19; sequence <= 34; sequence += 1) {
      expect(at(sequence)).toBeCloseTo(18.4, 5)
    }
    for (let sequence = 35; sequence < 39; sequence += 1) {
      expect(at(sequence + 1)).toBeLessThan(at(sequence))
    }
    for (let sequence = 39; sequence <= 45; sequence += 1) {
      expect(at(sequence)).toBeCloseTo(1.8, 5)
    }

    expect(accuracy.filter((value) => value > 10).length).toBeGreaterThanOrEqual(19)
    for (let index = 1; index < accuracy.length; index += 1) {
      expect(Math.abs(accuracy[index] - accuracy[index - 1])).toBeLessThan(4)
    }
  })

  it('lowers the battery into the critical range and restores it during samples 50-74', () => {
    const charge = collectSamples(80).map(
      (sample) => sample.battery.stateOfChargePercent,
    )
    const at = (sequence: number) => charge[sequence - 1]

    expect(at(49)).toBeGreaterThan(70)
    for (let sequence = 49; sequence < 56; sequence += 1) {
      expect(at(sequence + 1)).toBeLessThan(at(sequence))
    }
    expect(at(55)).toBeGreaterThan(15)
    for (let sequence = 56; sequence <= 69; sequence += 1) {
      expect(at(sequence)).toBeCloseTo(14, 5)
    }
    for (let sequence = 69; sequence < 74; sequence += 1) {
      expect(at(sequence + 1)).toBeGreaterThan(at(sequence))
    }
    for (let sequence = 74; sequence <= 80; sequence += 1) {
      expect(at(sequence)).toBeCloseTo(16, 5)
    }

    const criticalSequences = charge
      .map((value, index) => ({ value, sequence: index + 1 }))
      .filter(({ value }) => value < 15)
      .map(({ sequence }) => sequence)
    expect(criticalSequences.length).toBeGreaterThanOrEqual(15)
    expect(criticalSequences[0]).toBeGreaterThanOrEqual(50)
    expect(criticalSequences.at(-1)).toBeLessThanOrEqual(74)
    for (let index = 1; index < charge.length; index += 1) {
      expect(Math.abs(charge[index] - charge[index - 1])).toBeLessThan(10)
    }
  })

  it('follows normal, GPS advisory, normal, battery critical, then stays normal', () => {
    const samples = collectSamples(100)
    const statuses = getStatuses(samples)
    const sequencesOf = (status: string) =>
      statuses.flatMap((value, index) => (value === status ? [index + 1] : []))
    const transitions = statuses.filter(
      (status, index) => index === 0 || status !== statuses[index - 1],
    )

    expect(transitions).toEqual(['normal', 'warning', 'normal', 'critical', 'normal'])
    const warning = sequencesOf('warning')
    expect(warning.length).toBeGreaterThanOrEqual(19)
    expect(Math.min(...warning)).toBeGreaterThanOrEqual(15)
    expect(Math.max(...warning)).toBeLessThanOrEqual(39)
    const critical = sequencesOf('critical')
    expect(critical.length).toBeGreaterThanOrEqual(15)
    expect(Math.min(...critical)).toBeGreaterThanOrEqual(50)
    expect(Math.max(...critical)).toBeLessThanOrEqual(74)

    expect(statuses.slice(74).every((status) => status === 'normal')).toBe(true)
    expect(samples).toHaveLength(100)
    expect(samples[99].gps.latitude).toBeLessThan(samples[74].gps.latitude)
  })

  it('freezes the GPS fix during samples 20-34 while other telemetry keeps updating', () => {
    let seed = 3
    const samples: TelemetrySample[] = []
    const stream = createMockTelemetryStream({
      random: () => {
        seed = (seed * 13 + 7) % 17
        return seed / 17
      },
    })
    stream.subscribe((sample) => samples.push(sample))
    stream.start()
    vi.advanceTimersByTime(40_000)
    stream.stop()
    const at = (sequence: number) => samples[sequence - 1]

    for (let sequence = 1; sequence <= 19; sequence += 1) {
      expect(at(sequence).gps.fixTimestamp).toBe(at(sequence).timestamp)
    }
    for (let sequence = 20; sequence <= 34; sequence += 1) {
      expect(at(sequence).gps.latitude).toBe(at(19).gps.latitude)
      expect(at(sequence).gps.longitude).toBe(at(19).gps.longitude)
      expect(at(sequence).gps.fixTimestamp).toBe(at(19).timestamp)
      expect(at(sequence).timestamp).toBeGreaterThan(at(sequence - 1).timestamp)
      expect(at(sequence).battery.stateOfChargePercent).toBeLessThan(
        at(sequence - 1).battery.stateOfChargePercent,
      )
    }
    const frozenYaws = new Set(
      samples.slice(19, 34).map((sample) => sample.pose.yawDegrees),
    )
    expect(frozenYaws.size).toBeGreaterThan(1)

    expect(at(35).gps.fixTimestamp).toBe(at(35).timestamp)
    expect(at(35).gps.latitude).not.toBe(at(34).gps.latitude)
    expect(
      distanceMeters(at(34).gps, at(35).gps),
    ).toBeCloseTo(5, 2)
    for (let sequence = 36; sequence <= 40; sequence += 1) {
      expect(at(sequence).gps.fixTimestamp).toBe(at(sequence).timestamp)
    }
  })

  it('freezes the GPS fix in the manual GPS advisory scenario until another mode is selected', () => {
    let seed = 3
    const samples: TelemetrySample[] = []
    const stream = createMockTelemetryStream({
      random: () => {
        seed = (seed * 13 + 7) % 17
        return seed / 17
      },
    })
    stream.subscribe((sample) => samples.push(sample))
    stream.start()
    vi.advanceTimersByTime(5_000)
    stream.setScenario('gps-advisory')
    vi.advanceTimersByTime(120_000)
    const frozen = samples.slice(5)
    stream.setScenario('battery-critical')
    vi.advanceTimersByTime(3_000)
    stream.stop()

    expect(frozen).toHaveLength(120)
    frozen.forEach((sample, index) => {
      expect(sample.gps.latitude).toBe(samples[4].gps.latitude)
      expect(sample.gps.longitude).toBe(samples[4].gps.longitude)
      expect(sample.gps.fixTimestamp).toBe(samples[4].timestamp)
      expect(sample.gps.accuracyMeters).toBeCloseTo(18.4, 5)
      expect(sample.timestamp).toBeGreaterThan(samples[index + 4].timestamp)
      expect(sample.pose.yawDegrees).not.toBe(samples[index + 4].pose.yawDegrees)
    })
    samples.slice(125).forEach((sample) => {
      expect(sample.gps.fixTimestamp).toBe(sample.timestamp)
    })
  })

  it('manual GPS advisory overrides the automatic battery-critical phase, then the timeline resumes', () => {
    const samples: TelemetrySample[] = []
    const stream = createMockTelemetryStream({ random: () => 0.5 })
    stream.subscribe((sample) => samples.push(sample))
    stream.start()
    vi.advanceTimersByTime(55_000)
    stream.setScenario('gps-advisory')
    vi.advanceTimersByTime(10_000)
    stream.setScenario('normal')
    vi.advanceTimersByTime(15_000)
    stream.stop()
    const at = (sequence: number) => samples[sequence - 1]
    const statuses = getStatuses(samples)

    expect(samples.map((sample) => sample.sequenceNumber)).toEqual(
      Array.from({ length: 80 }, (_, index) => index + 1),
    )
    for (let sequence = 56; sequence <= 65; sequence += 1) {
      expect(at(sequence).gps.accuracyMeters).toBeCloseTo(18.4, 5)
      expect(at(sequence).battery.stateOfChargePercent).toBeGreaterThan(70)
      expect(statuses[sequence - 1]).toBe('warning')
    }
    for (let sequence = 66; sequence <= 69; sequence += 1) {
      expect(at(sequence).battery.stateOfChargePercent).toBeCloseTo(14, 5)
      expect(statuses[sequence - 1]).toBe('critical')
    }
    for (let sequence = 74; sequence <= 80; sequence += 1) {
      expect(at(sequence).battery.stateOfChargePercent).toBeCloseTo(16, 5)
      expect(statuses[sequence - 1]).toBe('normal')
    }
  })

  it('manual battery critical isolates GPS during the automatic GPS phase, then the timeline resumes', () => {
    const samples: TelemetrySample[] = []
    const stream = createMockTelemetryStream({ random: () => 0.5 })
    stream.subscribe((sample) => samples.push(sample))
    stream.start()
    vi.advanceTimersByTime(14_000)
    stream.setScenario('battery-critical')
    vi.advanceTimersByTime(20_000)
    stream.setScenario('normal')
    vi.advanceTimersByTime(6_000)
    stream.stop()
    const at = (sequence: number) => samples[sequence - 1]
    const statuses = getStatuses(samples)

    for (let sequence = 15; sequence <= 34; sequence += 1) {
      expect(at(sequence).battery.stateOfChargePercent).toBe(9)
      expect(at(sequence).gps.accuracyMeters).toBeCloseTo(1.8, 5)
      expect(at(sequence).gps.fixTimestamp).toBe(at(sequence).timestamp)
      expect(statuses[sequence - 1]).toBe('critical')
    }
    expect(at(35).gps.accuracyMeters).toBeCloseTo(15.08, 2)
    expect(at(36).gps.accuracyMeters).toBeLessThan(at(35).gps.accuracyMeters)
    expect(at(39).gps.accuracyMeters).toBeCloseTo(1.8, 5)
    expect(at(40).sequenceNumber).toBe(40)
    expect(statuses[34]).toBe('warning')
  })

  it('routes deterministic scenarios through processing and pauses when offline', () => {
    const results: TelemetryProcessingResult[] = []
    let timestamp = 1_700_000_000_000
    const stream = createMockTelemetryStream({
      random: () => 0.75,
      now: () => timestamp++,
    })
    stream.subscribe((sample) => results.push(processTelemetrySample(sample)))
    stream.start()
    vi.advanceTimersByTime(1_000)

    stream.setScenario('gps-advisory')
    vi.advanceTimersByTime(1_000)
    stream.setScenario('battery-critical')
    vi.advanceTimersByTime(1_000)
    stream.setScenario('offline')
    vi.advanceTimersByTime(2_000)
    expect(results).toHaveLength(3)

    const gpsScenario = results[1]
    const batteryScenario = results[2]
    expect(gpsScenario?.valid).toBe(true)
    expect(batteryScenario?.valid).toBe(true)
    if (!gpsScenario?.valid || !batteryScenario?.valid) {
      throw new Error('Expected scenario samples to be valid')
    }
    expect(gpsScenario.telemetry.sample.gps.accuracyMeters).toBe(18.4)
    expect(gpsScenario.telemetry.advisories.gpsAccuracy).toBe(true)
    expect(batteryScenario.telemetry.sample.battery.stateOfChargePercent).toBe(9)
    expect(batteryScenario.telemetry.advisories.batteryCritical).toBe(true)

    stream.setScenario('normal')
    vi.advanceTimersByTime(1_000)
    expect(results).toHaveLength(4)
    stream.stop()
  })
})