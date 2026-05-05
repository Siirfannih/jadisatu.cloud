'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Dipindahkan ke /mandala/conversations
export default function AiAgentTrainingPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/mandala/conversations') }, [router])
  return null
}
