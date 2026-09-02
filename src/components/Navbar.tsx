'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Navbar() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex space-x-4 items-center">
            <Link href="/dashboard" className="text-white font-semibold">
              Dashboard
            </Link>
            <Link href="/catalog" className="text-gray-300 hover:text-white">
              Catálogo
            </Link>
            <Link href="/import" className="text-gray-300 hover:text-white">
              Importar
            </Link>
            <Link href="/approvals" className="text-gray-300 hover:text-white">
              Aprobaciones
            </Link>
            <Link href="/pending" className="text-gray-300 hover:text-white">
              Pendientes
            </Link>
            <Link href="/stock" className="text-gray-300 hover:text-white">
              Stock
            </Link>
            <Link href="/pos" className="text-gray-300 hover:text-white">
              POS
            </Link>
            <Link href="/cash" className="text-gray-300 hover:text-white">
              Caja
            </Link>
            <Link href="/sales/history" className="text-gray-300 hover:text-white">
              Ventas
            </Link>
            <Link href="/settings" className="text-gray-300 hover:text-white">
              Configuración
            </Link>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </nav>
  )
}