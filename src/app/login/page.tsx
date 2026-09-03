'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden flex flex-col bg-gradient-to-br from-[#6FA893] via-[#4E8A82] to-[#3D7373] select-none">
      {/* Fondo orgánico */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[10%] w-[50rem] h-[40rem] rounded-full bg-[#A8D6BD]/40 blur-[120px]" />
        <div className="absolute top-[5%] right-[10%] w-[45rem] h-[45rem] rounded-full bg-[#97C5D2]/35 blur-[120px]" />
        <div className="absolute bottom-[10%] left-[25%] w-[55rem] h-[45rem] rounded-full bg-[#5E9189]/40 blur-[130px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-black/10" />
      </div>

      {/* Contenido principal */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 items-center">
          
          {/* Branding Mega Shop */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left px-2 sm:px-4">
            <img
              src="/logo-mega-shop.png"
              alt="Mega Shop Rivadavia"
              className="h-20 sm:h-24 md:h-28 w-auto object-contain filter drop-shadow-[0_12px_20px_rgba(0,0,0,0.3)] mb-4 pointer-events-none"
            />
            <h1 className="text-white text-2xl sm:text-3xl font-extrabold drop-shadow-md leading-tight">
              Gestión Inteligente
            </h1>
            <p className="text-white/75 text-sm sm:text-base mt-2 max-w-sm">
              Punto de venta, inventario en tiempo real e inteligencia comercial para tu negocio.
            </p>
          </div>

          {/* Card Login */}
          <div className="bg-white/15 backdrop-blur-2xl border border-white/25 rounded-3xl p-6 sm:p-8 shadow-2xl w-full">
            <div className="mb-6">
              <h2 className="text-white text-xl sm:text-2xl font-extrabold drop-shadow">
                Iniciar Sesión
              </h2>
              <p className="text-white/70 text-xs sm:text-sm mt-1">
                Ingresá tus credenciales para acceder al sistema
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-bold text-white/80 uppercase tracking-wider ml-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@megashop.com"
                  className="w-full px-4 py-3.5 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-2xl focus:bg-white/20 focus:border-white/40 outline-none transition-all text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-xs font-bold text-white/80 uppercase tracking-wider ml-1">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-2xl focus:bg-white/20 focus:border-white/40 outline-none transition-all text-sm font-medium"
                />
              </div>

              {error && (
                <div className="bg-rose-500/20 backdrop-blur-xl border border-rose-300/30 text-white text-xs sm:text-sm font-medium rounded-2xl p-3.5 shadow-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] text-white font-extrabold text-base shadow-xl border border-white/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Ingresando...</span>
                  </div>
                ) : (
                  'Ingresar al sistema'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* FOOTER centrado — branding bydotcom más grande */}
      <footer className="relative z-10 w-full pb-6 sm:pb-8 px-4">
        <div className="mx-auto max-w-md">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-5 py-4 shadow-lg flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <img
              src="/logo-desarrollo-digital.png"
              alt="Desarrollo Digital"
              className="h-10 sm:h-12 w-auto object-contain drop-shadow-md"
              onError={(e) => {
                ;(e.target as HTMLElement).style.display = 'none'
              }}
            />
            <div className="text-center sm:text-left">
              <div className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                Desarrollado por
              </div>
              <a
                href="https://www.bydotcom.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white text-base sm:text-lg font-extrabold hover:underline underline-offset-4 decoration-white/40 transition-all"
              >
                www.bydotcom.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}