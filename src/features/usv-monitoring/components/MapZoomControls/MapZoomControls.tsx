import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import styles from './MapZoomControls.module.scss'

export function MapZoomControls() {
  const map = useMap()
  const controlsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = controlsRef.current
    if (!element) return
    L.DomEvent.disableClickPropagation(element)
    L.DomEvent.disableScrollPropagation(element)
  }, [])

  return (
    <div ref={controlsRef} className={styles.mapZoomControls}>
      <button
        type="button"
        className={styles.mapZoomControls__button}
        aria-label="Zoom in"
        onClick={() => map.zoomIn()}
      >
        <span aria-hidden="true">+</span>
      </button>
      <button
        type="button"
        className={styles.mapZoomControls__button}
        aria-label="Zoom out"
        onClick={() => map.zoomOut()}
      >
        <span aria-hidden="true">−</span>
      </button>
    </div>
  )
}
