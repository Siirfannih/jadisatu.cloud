'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// My Network telah digabung ke CRM Pipeline
export default function MyNetworkPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/crm') }, [router])
  return null
}
