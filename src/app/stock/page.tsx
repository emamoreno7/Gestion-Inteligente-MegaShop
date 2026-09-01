'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

type StockLevel = {
  location_id: string
  product_id: string
  quantity: number
  product: {
    name: string
    sku: string | null
    barcode: string | null
    category: {
      name: string
    } | null
  }
}

type StockMovement = {
  id: string
  product_id: string
  quantity_change: number
  movement_type: string
  created_at: string
  product: {
    name: string
    sku: string | null
  } | null
  user: {
    full_name: string
  } | null
}

export default function StockPage() {
  const [tab, setTab] = useState<'current' | 'movements'>('current')
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)

      if (tab === 'current') {
        const { data, error } = await supabase
          .from('stock_levels')
          .select(`
            location_id,
            product_id,
            quantity,
            product:products (
              name,
              sku,
              barcode,
              category:categories (name)
            )
          `)
          .order('quantity', { ascending: false })

        if (!error && data) {
          setStockLevels(data as unknown as StockLevel[])
        }
      } else {
        const { data, error } = await supabase
          .from('stock_movements')
          .select(`
            id,
            product_id,
            quantity_change,
            movement_type,
            created_at,
            product:products (name, sku),
            user:users (full_name)
          `)
          .order('created_at', { ascending: false })
          .limit(100)

        if (!error && data) {
          setMovements(data as unknown as StockMovement[])
        }
      }

      setLoading(false)
    }

    loadData()
  }, [tab, supabase])

  const filteredStock = stockLevels.filter(item =>
    item.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
    item.product?.sku?.toLowerCase().includes(search.toLowerCase())
  )

  const formatCurrency = (value: number) => {
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">Stock</h1>

          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setTab('current')}
              className={`px-4 py-2 rounded ${tab === 'current' ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              Stock actual
            </button>
            <button
              onClick={() => setTab('movements')}
              className={`px-4 py-2 rounded ${tab === 'movements' ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              Movimientos
            </button>
          </div>

          {tab === 'current' && (
            <input
              type="text"
              placeholder="Buscar por nombre o SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full mb-4 px-4 py-2 bg-gray-800 text-white border border-gray-600 rounded"
            />
          )}

          {loading ? (
            <p className="text-gray-300">Cargando...</p>
          ) : tab === 'current' ? (
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Producto</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">SKU</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Rubro</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-gray-400">
                        No hay stock registrado.
                      </td>
                    </tr>
                  ) : (
                    filteredStock.map((item) => (
                      <tr key={`${item.location_id}-${item.product_id}`}>
                        <td className="px-4 py-2 text-sm text-white">{item.product?.name || '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-300">{item.product?.sku || '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-300">
                          {item.product?.category?.name || 'sin rubro'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-300">{item.quantity}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Fecha</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Producto</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Tipo</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Cantidad</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-300">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-gray-400">
                        No hay movimientos registrados.
                      </td>
                    </tr>
                  ) : (
                    movements.map((mov) => (
                      <tr key={mov.id}>
                        <td className="px-4 py-2 text-sm text-gray-300">
                          {new Date(mov.created_at).toLocaleString('es-AR')}
                        </td>
                        <td className="px-4 py-2 text-sm text-white">{mov.product?.name || '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-300">{mov.movement_type}</td>
                        <td className="px-4 py-2 text-sm text-gray-300">
                          <span className={mov.quantity_change >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {mov.quantity_change >= 0 ? '+' : ''}{mov.quantity_change}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-300">
                          {mov.user?.full_name || 'Desconocido'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}