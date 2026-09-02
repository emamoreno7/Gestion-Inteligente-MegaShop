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

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800 rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold text-white mb-4">Dashboard</h1>
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

            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
              <Link href="/catalog" className="p-4 bg-gray-700 rounded text-white hover:bg-gray-600">
                Catálogo
              </Link>
              <Link href="/import" className="p-4 bg-gray-700 rounded text-white hover:bg-gray-600">
                Importar
              </Link>
              <Link href="/approvals" className="p-4 bg-gray-700 rounded text-white hover:bg-gray-600">
                Aprobaciones
              </Link>
              <Link href="/stock" className="p-4 bg-gray-700 rounded text-white hover:bg-gray-600">
                Stock
              </Link>
              <Link href="/pos" className="p-4 bg-gray-700 rounded text-white hover:bg-gray-600">
                Punto de Venta
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}