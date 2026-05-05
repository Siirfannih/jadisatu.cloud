'use client'

import { useState, useEffect } from 'react'

/**
 * Returns true when the media query matches (e.g. window width < 1024px for lg breakpoint).
 * SSR-safe: defaults to false so layout doesn't flash on first paint.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** True when viewport is below Tailwind lg (1024px) */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)')
}

/** True when viewport is below Tailwind md (768px) */
export function useIsSmall(): boolean {
  return useMediaQuery('(max-width: 767px)')
}
