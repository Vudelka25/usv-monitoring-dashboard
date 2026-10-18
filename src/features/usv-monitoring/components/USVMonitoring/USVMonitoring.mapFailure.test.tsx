import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { USVMonitoring } from './USVMonitoring'

const mapFailure = vi.hoisted(() => ({ active: false }))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => {
    if (mapFailure.active) throw new Error('map failed')
    return <div data-testid="map-container">{children}</div>
  },
  TileLayer: () => null,
  Marker: ({ children }: { children: ReactNode }) => <div data-testid="usv-marker">{children}</div>,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useMap: () => ({ zoomIn: vi.fn(), zoomOut: vi.fn(), closePopup: vi.fn() }),
}))

describe('USVMonitoring map failure isolation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.75)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mapFailure.active = true
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps every other panel and the live telemetry working when the map fails', () => {
    render(<USVMonitoring />)
    act(() => vi.advanceTimersByTime(1_000))

    const figure = screen.getByRole('figure', { name: 'USV geographic map' })
    expect(within(figure).getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'NORMAL · USV ONLINE' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Vessel information' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Live telemetry overview' })).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'Telemetry mode' }), {
      target: { value: 'battery-critical' },
    })
    act(() => vi.advanceTimersByTime(1_000))

    expect(screen.getByRole('heading', { name: 'LOW BATTERY · MV SENTINEL' })).toBeInTheDocument()
    expect(within(figure).getByRole('alert')).toBeInTheDocument()
  })

  it('restores the map after Try again once the failure is gone', () => {
    render(<USVMonitoring />)
    act(() => vi.advanceTimersByTime(1_000))
    mapFailure.active = false

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
    expect(screen.getByTestId('usv-marker')).toBeInTheDocument()
  })
})
