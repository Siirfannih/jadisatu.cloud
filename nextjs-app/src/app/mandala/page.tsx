'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Overview removed — Dashboard already covers this.
// Redirect /mandala to /mandala/conversations (most actionable page)
export default function MandalaPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/mandala/conversations') }, [router])
  return null
}
