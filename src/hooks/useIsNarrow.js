import { useEffect, useState } from 'react'

/**
 * Devuelve true si el viewport es <= maxWidth (default 640px).
 * Se actualiza al rotar / cambiar tamaño de ventana.
 */
export function useIsNarrow(maxWidth = 640) {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(`(max-width: ${maxWidth}px)`).matches
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const handler = e => setIsNarrow(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [maxWidth])
  return isNarrow
}
