'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Dipindahkan ke /mandala/knowledge
export default function AiAgentKnowledgePage() {
  const router = useRouter()
  useEffect(() => { router.replace('/mandala/knowledge') }, [router])
  return null
}
