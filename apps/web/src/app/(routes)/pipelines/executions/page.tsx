"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PipelinesExecutions() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to Monitor page (renamed from Orchestration > Monitor)
    router.replace('/orchestration/monitor')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-foreground-muted">Redirecting to Executions...</p>
    </div>
  )
}
