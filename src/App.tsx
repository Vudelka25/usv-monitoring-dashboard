import { ErrorBoundary, ErrorFallback, USVMonitoring } from './features/usv-monitoring'

function App() {
  return (
    <ErrorBoundary
      fallback={(reset) => (
        <ErrorFallback
          fullPage
          message="Something went wrong while displaying the dashboard."
          onRetry={reset}
        />
      )}
    >
      <USVMonitoring />
    </ErrorBoundary>
  )
}

export default App
