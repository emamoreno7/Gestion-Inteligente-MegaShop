export type ErrorPayload = {
    message: string
    stack?: string | null
    route?: string
    metadata?: Record<string, any>
  }
  
  export async function logErrorToServer(payload: ErrorPayload): Promise<void> {
    try {
      await fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (e) {
      // Silencioso para no generar bucles de errores
    }
  }