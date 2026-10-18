import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { USVMonitoring } from './USVMonitoring'

vi.mock('react-leaflet', () => ({
  MapContainer: ({
    center,
    zoom,
    children,
  }: {
    center: [number, number]
    zoom: number
    children: ReactNode
  }) => (
    <div data-testid="map-container" data-center={center.join(',')} data-zoom={zoom}>
      {children}
    </div>
  ),
  TileLayer: ({ attribution }: { attribution: string }) => (
    <div data-testid="tile-layer" data-attribution={attribution} />
  ),
  Marker: ({
    position,
    children,
  }: {
    position: [number, number]
    children: ReactNode
  }) => (
    <div
      data-testid="usv-marker"
      data-position={position.join(',')}
    >
      {children}
    </div>
  ),
  Popup: ({ children }: { children: ReactNode }) => (
    <div data-testid="marker-popup">{children}</div>
  ),
  useMap: () => ({
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    closePopup: vi.fn(),
  }),
}))

afterEach(cleanup)

describe('USVMonitoring', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.75)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders the live overview and opens GPS and battery details', () => {
    render(<USVMonitoring />)

    expect(screen.getByRole('heading', { name: 'CONNECTING · AWAITING TELEMETRY' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Data quality and recovery' })).toHaveTextContent('WAITING FOR TELEMETRY')
    expect(screen.queryByText('STREAM DISCONNECTED')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'DEMCON' })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: 'USV geographic map' })).toBeInTheDocument()
    expect(screen.getByTestId('map-container')).toHaveAttribute('data-center', '45.71,31.09')
    expect(screen.getByTestId('map-container')).toHaveAttribute('data-zoom', '16')
    expect(screen.getByTestId('tile-layer').getAttribute('data-attribution')).toContain('OpenStreetMap')

    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByRole('heading', { name: 'NORMAL · USV ONLINE' })).toBeInTheDocument()
    const mapContainer = screen.getByTestId('map-container')
    const marker = screen.getByTestId('usv-marker')
    expect(screen.getByTestId('marker-popup')).toHaveTextContent('MV SENTINEL')

    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByTestId('map-container')).toBe(mapContainer)
    expect(screen.getByTestId('usv-marker')).toBe(marker)
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'P' &&
          Boolean(element.textContent?.includes(' · FRESH ')),
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /GPS & POSE DETAILS/ }))
    expect(screen.getByRole('complementary', { name: 'GPS and pose details' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /CLOSE DETAILS/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /CLOSE DETAILS/ }))
    fireEvent.click(screen.getByRole('button', { name: /BATTERY DETAILS/ }))
    expect(screen.getByRole('complementary', { name: 'Battery details' })).toBeInTheDocument()
    expect(screen.getByText(/Power [0-9.]+ W/)).toBeInTheDocument()
  })

  it('keeps the application title visible across connection and telemetry states', () => {
    render(<USVMonitoring />)
    const title = () => screen.getByText('USV TELEMETRY')

    expect(title()).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'LIVE STREAM · 1 Hz' })).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_000))
    expect(title()).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'Telemetry mode' }), {
      target: { value: 'gps-advisory' },
    })
    act(() => vi.advanceTimersByTime(4_000))
    expect(screen.getByRole('region', { name: 'GPS position' })).toHaveTextContent('STALE')
    expect(title()).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'Telemetry mode' }), {
      target: { value: 'battery-critical' },
    })
    act(() => vi.advanceTimersByTime(1_000))
    expect(title()).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'Telemetry mode' }), {
      target: { value: 'offline' },
    })
    act(() => vi.advanceTimersByTime(3_001))
    expect(screen.getByRole('heading', { name: 'LINK LOST · TELEMETRY STALE' })).toBeInTheDocument()
    expect(title()).toBeInTheDocument()
  })

  it('keeps advisory accuracy consistent across the banner, map, and details', () => {
    render(<USVMonitoring />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Telemetry mode' }), {
      target: { value: 'gps-advisory' },
    })
    act(() => vi.advanceTimersByTime(1_000))

    expect(screen.getByRole('heading', { name: 'ADVISORY · GPS ACCURACY DEGRADED' })).toBeInTheDocument()
    expect(screen.getByText('ACCURACY · 18.4 m')).toBeInTheDocument()
    expect(screen.getByTestId('marker-popup')).toHaveTextContent('GPS accuracy ±18.4 m')
    expect(screen.getByText('Measured accuracy 18.4 m')).toBeInTheDocument()
  })

  it('shows a stale GPS fix with a ticking age while the stream stays live, then recovers', () => {
    render(<USVMonitoring />)
    const gpsPanel = () => screen.getByRole('region', { name: 'GPS position' })
    const popup = () => screen.getByTestId('marker-popup')
    const coordinates = () => popup().querySelector('[class*="vesselMarker__coordinates"]')?.textContent
    const pose = () => screen.getByRole('region', { name: 'Vessel pose' }).textContent

    act(() => vi.advanceTimersByTime(21_000))
    expect(popup()).toHaveTextContent('Fresh · 2s ago')
    expect(gpsPanel()).not.toHaveTextContent('STALE')

    act(() => vi.advanceTimersByTime(1_000))
    expect(popup()).toHaveTextContent('Last known · 3s ago')
    expect(gpsPanel()).toHaveTextContent('ACCURACY · 18.4 m · STALE')
    expect(screen.getByRole('heading', { name: 'ADVISORY · GPS ACCURACY DEGRADED' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'GPS quality advisory' })).toHaveTextContent(
      'Last known GPS fix · 3s ago',
    )
    const frozenCoordinates = coordinates()
    const poseAtThreeSeconds = pose()

    act(() => vi.advanceTimersByTime(1_000))
    expect(popup()).toHaveTextContent('Last known · 4s ago')
    expect(coordinates()).toBe(frozenCoordinates)
    expect(pose()).not.toBe(poseAtThreeSeconds)

    act(() => vi.advanceTimersByTime(11_000))
    expect(popup()).toHaveTextContent('Last known · 15s ago')
    expect(coordinates()).toBe(frozenCoordinates)

    act(() => vi.advanceTimersByTime(1_000))
    expect(popup()).toHaveTextContent('Fresh · 0s ago')
    expect(gpsPanel()).not.toHaveTextContent('STALE')
    act(() => vi.advanceTimersByTime(5_000))
    expect(coordinates()).not.toBe(frozenCoordinates)
  })

  it('keeps counting the GPS age after the whole stream stops', () => {
    render(<USVMonitoring />)
    act(() => vi.advanceTimersByTime(5_000))
    fireEvent.change(screen.getByRole('combobox', { name: 'Telemetry mode' }), {
      target: { value: 'offline' },
    })

    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.getByTestId('marker-popup')).toHaveTextContent('Last known · 10s ago')
  })

  it('renders critical and offline states and reconnects the local stream', () => {
    render(<USVMonitoring />)
    const scenario = screen.getByRole('combobox', { name: 'Telemetry mode' })
    fireEvent.change(scenario, { target: { value: 'battery-critical' } })
    act(() => vi.advanceTimersByTime(1_000))

    expect(screen.getByRole('heading', { name: 'LOW BATTERY · MV SENTINEL' })).toBeInTheDocument()
    expect(screen.getByText('SOC 9% · threshold 15%')).toBeInTheDocument()
    const lastKnownPosition = screen.getByTestId('usv-marker').getAttribute('data-position')

    fireEvent.change(scenario, { target: { value: 'offline' } })
    act(() => vi.advanceTimersByTime(3_001))
    expect(screen.getByRole('heading', { name: 'LINK LOST · TELEMETRY STALE' })).toBeInTheDocument()
    expect(screen.getByText('LAST KNOWN · STALE')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Data quality and recovery' })).toHaveTextContent(
      'Position is last known, not live.',
    )
    expect(screen.getByTestId('usv-marker').getAttribute('data-position')).toBe(
      lastKnownPosition,
    )

    fireEvent.click(screen.getByRole('button', { name: 'RECONNECT STREAM' }))
    expect(screen.getByRole('combobox', { name: 'Telemetry mode' })).toHaveValue('normal')
    expect(screen.getByRole('heading', { name: 'LINK LOST · TELEMETRY STALE' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByRole('heading', { name: 'NORMAL · USV ONLINE' })).toBeInTheDocument()
  })
})