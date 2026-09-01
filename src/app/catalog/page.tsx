'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Product = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  sale_price: number | null
  cost_price: number | null
  category_id: string | null
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const supabase = createClient()

  const loadProducts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, barcode, sale_price, cost_price, category_id')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
    } else {
      setProducts(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const name = formData.get('name') as string
    const sku = formData.get('sku') as string
    const barcode = formData.get('barcode') as string
    const sale_price = parseFloat(formData.get('sale_price') as string)
    const cost_price = parseFloat(formData.get('cost_price') as string)

    // Obtener usuario autenticado
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('products').insert({
      name,
      sku: sku || null,
      barcode: barcode || null,
      sale_price,
      cost_price,
      created_by: user.id,
    })

    if (error) {
      console.error(error)
      alert('Error al crear producto: ' + error.message)
    } else {
      form.reset()
      setShowForm(false)
      loadProducts()
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Catálogo de Productos</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
          >
            {showForm ? 'Cancelar' : 'Agregar producto'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAddProduct} className="bg-gray-800 shadow rounded p-6 mb-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Nuevo producto</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Nombre *</label>
                <input name="name" required className="mt-1 w-full bg-gray-700 text-whit border border-gray-600 rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">SKU</label>
                <input name="sku" className="mt-1 w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Código de barras</label>
                <input name="barcode" className="mt-1 w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Precio de venta</label>
                <input name="sale_price" type="number" step="0.01" className="mt-1 w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Precio de costo</label>
               <input name="cost_price" type="number" step="0.01" className="mt-1 w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2" />
              </div>
            </div>
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              Guardar producto
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-gray-300">Cargando productos...</p>
        ) : products.length === 0 ? (
          <div className="bg-gray-800 shadow rounded p-10 text-center text-gray-400">
            No hay productos todavía. Agrega el primero.
          </div>
        ) : (
          <div className="bg-gray-800 shadow rounded overflow-hidden">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300">Nombre</th>
                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-300">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300">Barcode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300">Precio venta</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300">Precio costo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-sm text-white">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{p.sku || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{p.barcode || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{p.sale_price ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{p.cost_price ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
