'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState<number>(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || null)
        const { count, error } = await supabase
          .from('bulk_imports')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending_approval')
        if (!error && count !== null) {
          setPendingCount(count)
        }
      } else {
        router.push('/login')
      }
    }
    getUser()
  }, [supabase, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800 rounded-lg shadow p-6 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Cerrar sesión
            </button>
          </div>

          <div className="mt-6 bg-gray-800 rounded-lg shadow p-6">
            <p className="text-gray-300">
              {userEmail ? `Sesión iniciada como: ${userEmail}` : 'Cargando...'}
            </p>

            {pendingCount > 0 && (
              <Link
                href="/approvals"
                className="mt-4 block bg-yellow-600 text-white px-4 py-3 rounded hover:bg-yellow-700"
              >
                Hay {pendingCount} carga(s) pendiente(s) de aprobación
              </Link>
            )}

            <nav className="mt-6 flex gap-4">
              <Link
                href="/catalog"
                className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
              >
                Catálogo
              </Link>
              <Link
                href="/import"
                className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
              >
                Importar
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600"
              >
                Dashboard
              </Link>
            </nav>

            <p className="mt-4 text-sm text-gray-400">
              Próximamente: stock, ventas, etc.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}