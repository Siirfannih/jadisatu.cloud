'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// AI Agent cockpit telah dipindahkan ke /mandala
export default function AiAgentPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/mandala') }, [router])
  return null
}
