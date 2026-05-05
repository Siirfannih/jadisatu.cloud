'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Dipindahkan ke /mandala/policies
export default function AiAgentPoliciesPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/mandala/policies') }, [router])
  return null
}
