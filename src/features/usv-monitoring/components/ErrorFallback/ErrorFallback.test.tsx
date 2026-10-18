import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorFallback } from './ErrorFallback'

afterEach(cleanup)

describe('ErrorFallback', () => {
  it('announces the configured message once as an alert', () => {
    render(<ErrorFallback message="The map could not be displayed." onRetry={() => {}} />)

    expect(screen.getByRole('alert')).toHaveTextContent('The map could not be displayed.')
  })

  it('calls onRetry from a keyboard-accessible Try again button', () => {
    const onRetry = vi.fn()
    render(<ErrorFallback message="Failed." onRetry={onRetry} />)

    const button = screen.getByRole('button', { name: 'Try again' })
    expect(button).toHaveAttribute('type', 'button')
    fireEvent.click(button)

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('applies a caller-provided class for placement', () => {
    render(<ErrorFallback message="Failed." onRetry={() => {}} className="placement" />)

    expect(screen.getByRole('alert')).toHaveClass('placement')
  })
})
