export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      const { createClient } = await import('@supabase/supabase-js')
  
      ;(globalThis as any).__logServerError = async (error: any, context?: any) => {
        try {
          if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return
  
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
          )
  
          await supabase.from('error_logs').insert({
            user_id: context?.userId || null,
            location_id: context?.locationId || null,
            source: 'backend',
            message: error?.message || error?.toString() || 'Error no especificado',
            stack: error?.stack || null,
            route: context?.route || null,
            metadata: context?.metadata || {},
          })
        } catch (e) {
          // silencioso para no generar bucles
        }
      }
    }
  }
  
  export function onRequestError(err: any, request: any, context: any) {
    const logFn = (globalThis as any).__logServerError
    if (typeof logFn === 'function') {
      logFn(err, {
        route: request?.nextUrl?.pathname || request?.url || null,
      })
    }
  }