import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { USV_VESSEL, type ProcessedTelemetry } from '../../types/telemetry.types'
import { VesselMap } from './VesselMap'

// These tests use the real Leaflet and react-leaflet to exercise a genuine map failure and recovery.
function createTelemetry(latitude: number): ProcessedTelemetry {
  return {
    sample: {
      timestamp: 1_700_000_000_000,
      sequenceNumber: 1,
      gps: { latitude, longitude: 31.09, accuracyMeters: 1.8, fixTimestamp: 1_700_000_000_000 },
      pose: { yawDegrees: 0, pitchDegrees: 0, rollDegrees: 0 },
      battery: { stateOfChargePercent: 78, voltageVolts: 24.6, currentAmps: 4.2 },
    },
    normalizedYawDegrees: 0,
    batteryPowerWatts: 103.32,
    advisories: { gpsAccuracy: false, batteryCritical: false },
  }
}

function mapElement(telemetry: ProcessedTelemetry) {
  return (
    <VesselMap vessel={USV_VESSEL} status="normal" telemetry={telemetry} gpsAge="0s ago" gpsStale={false} />
  )
}

describe('VesselMap error boundary', () => {
  let consoleError: MockInstance<typeof console.error>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the Leaflet map and marker without a fallback when nothing fails', () => {
    const { container } = render(mapElement(createTelemetry(45.71)))

    expect(container.querySelector('.leaflet-container')).toBeInTheDocument()
    expect(container.querySelector('.leaflet-marker-icon')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the fallback inside the existing figure when Leaflet throws', () => {
    const { container } = render(mapElement(createTelemetry(Number.NaN)))

    const figure = screen.getByRole('figure', { name: 'USV geographic map' })
    expect(within(figure).getByRole('alert')).toHaveTextContent('The map could not be displayed.')
    expect(container.querySelector('.leaflet-container')).not.toBeInTheDocument()
  })

  it('keeps the fallback when Try again is pressed while the error is still present', () => {
    render(mapElement(createTelemetry(Number.NaN)))

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('initializes a fresh map after Try again once the data is valid', () => {
    const { container, rerender } = render(mapElement(createTelemetry(Number.NaN)))
    rerender(mapElement(createTelemetry(45.71)))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.leaflet-container')).toHaveLength(1)
    expect(container.querySelector('.leaflet-marker-icon')).toBeInTheDocument()
    const messages = consoleError.mock.calls.map((call) => String(call[0]))
    expect(messages.some((message) => message.includes('already initialized'))).toBe(false)
  })
})
