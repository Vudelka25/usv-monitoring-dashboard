import styles from './ErrorFallback.module.scss'

interface ErrorFallbackProps {
  message: string
  onRetry: () => void
  className?: string
  fullPage?: boolean
}

export function ErrorFallback({ message, onRetry, className, fullPage = false }: ErrorFallbackProps) {
  const classes = [styles.errorFallback, fullPage && styles['errorFallback--page'], className]
    .filter(Boolean)
    .join(' ')

  return (
    <div role="alert" className={classes}>
      <p className={styles.errorFallback__message}>{message}</p>
      <button type="button" className={styles.errorFallback__button} onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}
