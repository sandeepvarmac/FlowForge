"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PipelinesDashboard() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to Overview page (renamed from Orchestration > Overview)
    router.replace('/orchestration/overview')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-foreground-muted">Redirecting to Dashboard...</p>
    </div>
  )
}
