'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Dashboard V1 sudah digantikan Dashboard baru
export default function DashboardV1Page() {
  const router = useRouter()
  useEffect(() => { router.replace('/') }, [router])
  return null
}
