import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: (reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  reset = (): void => {
    this.setState({ hasError: false })
  }

  render(): ReactNode {
    return this.state.hasError ? this.props.fallback(this.reset) : this.props.children
  }
}
