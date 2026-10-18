import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { forwardRef, useImperativeHandle, type ForwardedRef, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { USV_VESSEL, type ProcessedTelemetry } from '../../types/telemetry.types'
import { MapZoomControls } from '../MapZoomControls'
import { VesselMarker } from './VesselMarker'

const map = vi.hoisted(() => ({
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  closePopup: vi.fn(),
}))

const leafletMarker = vi.hoisted(() => ({
  position: [45.6979, 31.0977] as [number, number],
  getLatLng: vi.fn(),
  setLatLng: vi.fn(),
}))

vi.mock('react-leaflet', () => ({
  Marker: forwardRef(({ children, position }: { children: ReactNode; position: [number, number] }, ref: ForwardedRef<unknown>) => {
    useImperativeHandle(ref, () => leafletMarker, [])
    return <div data-marker-position={position.join(',')}>{children}</div>
  }),
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useMap: () => map,
}))

const animationFrames = new Map<number, FrameRequestCallback>()
let nextAnimationFrameId = 0

beforeEach(() => {
  animationFrames.clear()
  nextAnimationFrameId = 0
  leafletMarker.position = [45.6979, 31.0977]
  leafletMarker.getLatLng.mockImplementation(() => ({
    lat: leafletMarker.position[0],
    lng: leafletMarker.position[1],
  }))
  leafletMarker.setLatLng.mockImplementation((position: [number, number]) => {
    leafletMarker.position = position
  })
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = ++nextAnimationFrameId
    animationFrames.set(id, callback)
    return id
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => animationFrames.delete(id)))
})

const telemetry: ProcessedTelemetry = {
  sample: {
    timestamp: 1,
    sequenceNumber: 1,
    gps: {
      latitude: 45.6979,
      longitude: 31.0977,
      accuracyMeters: 2.8,
      fixTimestamp: 1,
    },
    pose: { yawDegrees: 0, pitchDegrees: 0, rollDegrees: 0 },
    battery: { stateOfChargePercent: 78, voltageVolts: 24.6, currentAmps: 4.2 },
  },
  normalizedYawDegrees: 0,
  batteryPowerWatts: 103.3,
  advisories: { gpsAccuracy: false, batteryCritical: false },
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function runNextAnimationFrame(timestamp: number): void {
  const next = animationFrames.entries().next().value as [number, FrameRequestCallback] | undefined
  if (!next) throw new Error('No animation frame is pending')
  animationFrames.delete(next[0])
  act(() => next[1](timestamp))
}

function withPosition(latitude: number, longitude: number): ProcessedTelemetry {
  return {
    ...telemetry,
    sample: {
      ...telemetry.sample,
      gps: { ...telemetry.sample.gps, latitude, longitude },
    },
  }
}

describe('VesselMarker popup', () => {
  it('shows fresh telemetry for a live status', () => {
    render(<VesselMarker vessel={USV_VESSEL} status="normal" telemetry={telemetry} age="0s ago" gpsStale={false} />)

    expect(screen.getByText('MV SENTINEL')).toBeInTheDocument()
    expect(screen.getByText('45.6979° N / 31.0977° E')).toBeInTheDocument()
    expect(screen.getByText('GPS accuracy ±2.8 m')).toBeInTheDocument()
    expect(screen.getByText('Fresh · 0s ago')).toHaveAttribute('data-state', 'fresh')
  })

  it('shows last-known telemetry when offline', () => {
    render(<VesselMarker vessel={USV_VESSEL} status="offline" telemetry={telemetry} age="3s ago" gpsStale={false} />)

    expect(screen.getByText('Last known · 3s ago')).toHaveAttribute('data-state', 'last-known')
  })

  it('shows a dynamic last-known age when GPS is stale but the stream is live', () => {
    render(<VesselMarker vessel={USV_VESSEL} status="gps-advisory" telemetry={telemetry} age="7s ago" gpsStale />)

    expect(screen.getByText('Last known · 7s ago')).toHaveAttribute('data-state', 'last-known')
  })

  it('closes the popup from the close button', () => {
    render(<VesselMarker vessel={USV_VESSEL} status="normal" telemetry={telemetry} age="0s ago" gpsStale={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Close vessel information' }))
    expect(map.closePopup).toHaveBeenCalledTimes(1)
  })

  it('interpolates movement and retargets from the current displayed position', () => {
    const view = render(
      <VesselMarker vessel={USV_VESSEL} status="normal" telemetry={telemetry} age="0s ago" gpsStale={false} />,
    )
    const initialMarkerPosition = screen.getByText('MV SENTINEL').closest('[data-marker-position]')
    const nextTelemetry = withPosition(45.6989, 31.0987)

    view.rerender(
      <VesselMarker vessel={USV_VESSEL} status="gps-advisory" telemetry={nextTelemetry} age="1s ago" gpsStale={false} />,
    )
    runNextAnimationFrame(100)
    runNextAnimationFrame(550)

    const halfwayPosition = [...leafletMarker.position] as [number, number]
    expect(halfwayPosition[0]).toBeCloseTo((telemetry.sample.gps.latitude + nextTelemetry.sample.gps.latitude) / 2)
    expect(initialMarkerPosition).toHaveAttribute('data-marker-position', '45.6979,31.0977')

    const finalTelemetry = withPosition(45.6999, 31.0997)
    view.rerender(
      <VesselMarker vessel={USV_VESSEL} status="normal" telemetry={finalTelemetry} age="2s ago" gpsStale={false} />,
    )
    expect(cancelAnimationFrame).toHaveBeenCalled()
    runNextAnimationFrame(600)
    runNextAnimationFrame(1050)

    expect(leafletMarker.position[0]).toBeCloseTo((halfwayPosition[0] + finalTelemetry.sample.gps.latitude) / 2)
    runNextAnimationFrame(1500)
    expect(leafletMarker.position).toEqual([45.6999, 31.0997])
  })

  it('ignores invalid coordinates and cancels pending frames on unmount', () => {
    const invalidView = render(
      <VesselMarker vessel={USV_VESSEL} status="normal" telemetry={withPosition(Number.NaN, 31.0977)} age="0s ago" gpsStale={false} />,
    )
    expect(invalidView.container.querySelector('[data-marker-position="NaN,31.0977"]')).toBeInTheDocument()
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    invalidView.unmount()

    const view = render(
      <VesselMarker vessel={USV_VESSEL} status="normal" telemetry={telemetry} age="0s ago" gpsStale={false} />,
    )
    view.rerender(
      <VesselMarker vessel={USV_VESSEL} status="normal" telemetry={withPosition(91, 31.0977)} age="1s ago" gpsStale={false} />,
    )
    expect(animationFrames.size).toBe(0)

    view.rerender(
      <VesselMarker vessel={USV_VESSEL} status="normal" telemetry={withPosition(45.6989, 31.0987)} age="1s ago" gpsStale={false} />,
    )
    expect(animationFrames.size).toBe(1)
    view.unmount()

    expect(animationFrames.size).toBe(0)
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })
})

describe('MapZoomControls', () => {
  it('zooms the map in and out', () => {
    render(<MapZoomControls />)

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))

    expect(map.zoomIn).toHaveBeenCalledTimes(1)
    expect(map.zoomOut).toHaveBeenCalledTimes(1)
  })
})
