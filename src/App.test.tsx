import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const hookFailure = vi.hoisted(() => ({ active: false }))

vi.mock('./features/usv-monitoring/hooks/useTelemetry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./features/usv-monitoring/hooks/useTelemetry')>()
  return {
    ...actual,
    useTelemetry: () => {
      if (hookFailure.active) throw new Error('dashboard failed')
      return actual.useTelemetry()
    },
  }
})

describe('App global error boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    hookFailure.active = false
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders the dashboard normally', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'CONNECTING · AWAITING TELEMETRY' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the fallback instead of a blank screen when the dashboard throws', () => {
    hookFailure.active = true
    render(<App />)

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong while displaying the dashboard.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByRole('main')).not.toBeInTheDocument()
  })

  it('restores the dashboard after Try again once the failure is gone', () => {
    hookFailure.active = true
    render(<App />)
    hookFailure.active = false

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'CONNECTING · AWAITING TELEMETRY' })).toBeInTheDocument()
  })

  it('keeps the fallback when the failure persists after Try again', () => {
    hookFailure.active = true
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('main')).not.toBeInTheDocument()
  })
})
