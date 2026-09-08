'use client'

import { useEffect } from 'react'
import { logErrorToServer } from '@/lib/logger'

export default function GlobalErrorLogger() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const error = event.error
      logErrorToServer({
        message: event.message || 'Error no capturado',
        stack: error?.stack || null,
        route: window.location.pathname,
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      })
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      logErrorToServer({
        message: reason?.message || 'Unhandled Promise Rejection',
        stack: reason?.stack || null,
        route: window.location.pathname,
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return null
}