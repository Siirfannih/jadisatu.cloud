'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Analitik Mandala sudah digabung ke /analytics (tab Mandala AI)
export default function MandalaAnalyticsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/analytics') }, [router])
  return null
}
