import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorFallback } from '../ErrorFallback'
import { ErrorBoundary } from './ErrorBoundary'

const failure = { active: true, value: new Error('render failed') as unknown }

function Child() {
  if (failure.active) throw failure.value
  return <p>child content</p>
}

function renderBoundary() {
  return render(
    <ErrorBoundary
      fallback={(reset) => <ErrorFallback message="Something went wrong." onRetry={reset} />}
    >
      <Child />
    </ErrorBoundary>,
  )
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    failure.active = true
    failure.value = new Error('render failed')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders its children when nothing fails', () => {
    failure.active = false
    renderBoundary()

    expect(screen.getByText('child content')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an accessible fallback instead of a blank screen when a child throws', () => {
    renderBoundary()

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText('child content')).not.toBeInTheDocument()
  })

  it('also catches values that are not Error instances', () => {
    failure.value = 'plain string failure'
    renderBoundary()

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders the children again after Try again once the cause is gone', () => {
    renderBoundary()
    failure.active = false

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByText('child content')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps showing the fallback when the error is still there after Try again', () => {
    renderBoundary()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('child content')).not.toBeInTheDocument()
  })
})
