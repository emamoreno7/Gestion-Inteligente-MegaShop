'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { classifyByKeywords } from '@/lib/classify'

type ProductRow = {
  name: string
  sku?: string | null
  barcode?: string | null
  cost_price?: number | null
  sale_price?: number | null
  category?: string | null
  quantity?: number
}

type Category = {
  id: string
  name: string
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export default function ImportPage() {
  const [tab, setTab] = useState<'file' | 'ocr'>('file')
  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [fileName, setFileName] = useState('')
  const [importType, setImportType] = useState<'csv' | 'excel' | 'ocr'>('csv')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [acceptedCheck, setAcceptedCheck] = useState(false)
  const [omitMap, setOmitMap] = useState<Record<number, boolean>>({})

  const router = useRouter()
  // Usamos useMemo para el client, buena práctica heredada
  const supabase = useMemo(() => createClient(), [])

  const calculateHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  useEffect(() => {
    const loadCategories = async () => {
      const { data, error } = await supabase.from('categories').select('id, name')
      if (error) {
        console.warn('Error cargando categorías:', error.message)
      } else if (data) {
        setCategories(data)
      }
    }
    loadCategories()
  }, [supabase])

  const normalizeNumber = (value: any): number | null => {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'number') return value

    let str = String(value).trim()
    str = str.replace(/[^0-9,.-]/g, '')

    const hasComma = str.includes(',')
    const hasDot = str.includes('.')

    if (hasComma && hasDot) {
      str = str.replace(/\./g, '').replace(',', '.')
    } else if (hasComma) {
      str = str.replace(',', '.')
    } else if (hasDot) {
      const parts = str.split('.')
      const isThousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3)
      if (isThousands) {
        str = str.replace(/\./g, '')
      }
    }

    const num = parseFloat(str)
    return isNaN(num) ? null : num
  }

  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return '0,00'
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const classifyProducts = async (productsToClassify: ProductRow[]): Promise<ProductRow[]> => {
    let partialClassified: ProductRow[] = productsToClassify.map((p) => ({
      ...p,
      category:
        p.category && p.category !== 'otros'
          ? p.category
          : classifyByKeywords(p.name) || p.category || 'otros',
    }))

    const pendingIndices: number[] = []
    const pendingProducts: ProductRow[] = []

    partialClassified.forEach((p, idx) => {
      if (!p.category || p.category === 'otros') {
        pendingIndices.push(idx)
        pendingProducts.push(p)
      }
    })

    if (pendingProducts.length > 0) {
      try {
        const res = await fetch('/api/import/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: pendingProducts }),
        })
        const data = await res.json()
        if (res.ok && data.classified) {
          const classifiedMap = new Map<number, string>()
          data.classified.forEach((item: { index: number; category: string }) => {
            classifiedMap.set(pendingIndices[item.index - 1], item.category)
          })
          partialClassified = partialClassified.map((p, idx) => ({
            ...p,
            category: classifiedMap.get(idx) || p.category || 'otros',
          }))
        }
      } catch (e) {
        console.error('Error clasificando con IA:', e)
      }
    }

    return partialClassified
  }

  const handleFileUpload = async (file: File) => {
    setError(null)
    setSuccess(null)
    setFileName(file.name)
    setLoading(true)

    try {
      if (file.name.endsWith('.csv') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
          raw: false,
          defval: '',
        })

        const normalized: ProductRow[] = rawData
          .filter((row) =>
            Object.values(row).some(
              (v) => v !== null && v !== undefined && String(v).trim() !== ''
            )
          )
          .map((row) => {
            const getValue = (...candidates: string[]) => {
              for (const candidate of candidates) {
                const key = Object.keys(row).find((k) =>
                  k.toLowerCase().includes(candidate.toLowerCase())
                )
                if (key) return row[key]
              }
              return undefined
            }

            const name = getValue(
              'name',
              'nombre',
              'producto',
              'descripcion',
              'descripción'
            ) as string | undefined
            const sku = getValue('sku', 'codigo', 'código', 'code') as string | undefined
            const barcode = getValue(
              'barcode',
              'codigo_barras',
              'código_barras'
            ) as string | undefined
            const cost_price = getValue(
              'cost_price',
              'costo',
              'costo unitario',
              'costo unit.',
              'costo unit',
              'precio_costo',
              'precio costo',
              'precio unitario',
              'precio unit.',
              'precio unit',
              'precio_unitario',
              'precio',
              'costo neto'
            ) as number | string | undefined
            const sale_price = getValue(
              'sale_price',
              'venta',
              'precio_venta',
              'precio venta',
              'precio',
              'precio de venta',
              'venta unitaria',
              'venta unit.',
              'venta unit'
            ) as number | string | undefined
            const quantity = getValue('quantity', 'cantidad', 'cant') as number | string | undefined
            const category = getValue('category', 'rubro', 'categoria') as string | undefined

            return {
              name: name?.toString() || 'Producto sin nombre',
              sku: sku?.toString() || null,
              barcode: barcode?.toString() || null,
              cost_price: normalizeNumber(cost_price),
              sale_price: normalizeNumber(sale_price),
              quantity: quantity ? parseInt(String(quantity)) : 1,
              category: category || null,
            }
          })

        const classified = await classifyProducts(normalized)
        setProducts(classified)
        setImportType(file.name.endsWith('.csv') ? 'csv' : 'excel')
      } else {
        setError('Formato no soportado. Usa CSV o Excel.')
      }
    } catch (e) {
      console.error('Error leyendo archivo:', e)
      setError('Error al leer el archivo. Mirá la consola (F12) para más detalle.')
    } finally {
      setLoading(false)
    }
  }

  const handleOCRUpload = async (file: File) => {
    setError(null)
    setSuccess(null)
    setFileName(file.name)
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/import/ocr', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error en OCR')
      } else if (data.products && Array.isArray(data.products)) {
        const productsFromOCR = data.products.map((p: any) => ({
          name: p.name || 'Producto',
          sku: p.sku || null,
          barcode: p.barcode || null,
          quantity: p.quantity ? parseInt(String(p.quantity)) : 1,
          cost_price: normalizeNumber(p.cost_price),
          sale_price: normalizeNumber(p.sale_price),
          category: p.category || 'otros',
        }))

        setProducts(productsFromOCR)
        setImportType('ocr')
      } else {
        setError('No se pudieron extraer productos. Revisa la imagen o intenta con otra.')
      }
    } catch (e) {
      console.error('Error leyendo archivo:', e)
      setError('Error al leer el archivo. Mirá la consola (F12) para detalle.')
    } finally {
      setLoading(false)
    }
  }

  const totalUnits = () => products.reduce((acc, p) => acc + (p.quantity || 1), 0)
  const totalCost = () =>
    products.reduce((acc, p) => acc + (p.cost_price || 0) * (p.quantity || 1), 0)

  const getCategorySummary = () => {
    const summary: Record<string, number> = {}
    products.forEach((p, idx) => {
      if (!omitMap[idx]) {
        const cat = p.category || 'otros'
        summary[cat] = (summary[cat] || 0) + (p.quantity || 1)
      }
    })
    return Object.entries(summary).map(([category, count]) => ({ category, count }))
  }

  const confirmSave = async () => {
    if (!acceptedCheck) {
      setError('Debes aceptar que has revisado los detalles.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const productsToSave = products.filter((_, idx) => !omitMap[idx])
      if (productsToSave.length === 0) {
        throw new Error('No hay productos seleccionados para guardar.')
      }

      let sourceHash: string | null = null
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput?.files?.[0]) {
        sourceHash = await calculateHash(fileInput.files[0])
      }

      const res = await fetch('/api/import/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: productsToSave,
          importType,
          fileName,
          sourceHash,
        }),
      })

      const responseData = await res.json()
      if (!res.ok) {
        throw new Error(responseData.error || 'Error al guardar')
      }

      const status = responseData.data?.status
      if (status === 'pending_approval') {
        setSuccess('Carga enviada para aprobación del encargado/admin.')
      } else if (status === 'completed') {
        setSuccess(`Se importaron ${productsToSave.length} productos y se actualizó el stock.`)
      } else {
        setSuccess('Operación completada.')
      }

      setProducts([])
      setFileName('')
      setShowAuditModal(false)
      setAcceptedCheck(false)
      setOmitMap({})
    } catch (e: any) {
      setError(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const toggleOmit = (idx: number) => {
    setOmitMap((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden bg-gradient-to-br from-[#6FA893] via-[#4E8A82] to-[#3D7373]">
      {/* Fondo orgánico */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[10%] w-[50rem] h-[40rem] rounded-full bg-[#A8D6BD]/40 blur-[120px]" />
        <div className="absolute top-[5%] right-[10%] w-[45rem] h-[45rem] rounded-full bg-[#97C5D2]/35 blur-[120px]" />
        <div className="absolute bottom-[10%] left-[25%] w-[55rem] h-[45rem] rounded-full bg-[#5E9189]/40 blur-[130px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-black/10" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 min-h-screen flex flex-col">
        {/* Header Superior */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/dashboard"
              className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/25 text-white hover:bg-white/25 transition-all shadow-lg shrink-0"
              title="Volver al inicio"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>

            <img
              src="/logo-mega-shop.png"
              alt="Mega Shop Rivadavia"
              className="h-9 sm:h-12 w-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)] select-none pointer-events-none"
            />

            <div className="pl-2 border-l border-white/20">
              <h1 className="text-white text-lg sm:text-2xl font-extrabold drop-shadow-lg leading-tight">
                Importar
              </h1>
              <p className="text-white/70 text-xs sm:text-sm">Carga masiva e inteligente</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/approvals"
              className="px-3.5 py-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all"
            >
              Aprobaciones
            </Link>
            <Link
              href="/catalog"
              className="px-3.5 py-2 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all"
            >
              Catálogo
            </Link>
          </div>
        </header>

        {/* Alertas Globales */}
        {(error || success) && !showAuditModal && (
          <div className="mb-5 space-y-2">
            {error && (
              <div className="bg-rose-500/20 backdrop-blur-xl border border-rose-300/30 text-white rounded-2xl px-4 py-3 text-sm font-medium shadow-lg">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-emerald-500/20 backdrop-blur-xl border border-emerald-300/30 text-white rounded-2xl px-4 py-3 text-sm font-medium shadow-lg">
                {success}
              </div>
            )}
          </div>
        )}

        {/* Área de Carga */}
        {!products.length && (
          <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
            <div className="flex gap-2 mb-6 p-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl w-fit mx-auto shadow-lg">
              <button
                onClick={() => setTab('file')}
                className={`px-5 sm:px-8 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  tab === 'file'
                    ? 'bg-white text-[#2F5E58] shadow-md'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                CSV / Excel
              </button>
              <button
                onClick={() => setTab('ocr')}
                className={`px-5 sm:px-8 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  tab === 'ocr'
                    ? 'bg-white text-[#2F5E58] shadow-md'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                Foto (IA)
              </button>
            </div>

            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 sm:p-10 shadow-2xl text-center">
              {loading ? (
                <div className="flex flex-col items-center py-10">
                  <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4" />
                  <p className="text-white font-bold text-lg drop-shadow">Procesando {tab === 'ocr' ? 'imagen con IA' : 'archivo'}...</p>
                  <p className="text-white/60 text-sm mt-2 max-w-sm">
                    {tab === 'ocr' 
                      ? 'Groq Vision está analizando y extrayendo los productos...' 
                      : 'Leyendo el archivo y clasificando rubros...'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 mx-auto bg-white/10 border border-white/20 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  
                  <h3 className="text-white text-xl font-extrabold mb-2">
                    {tab === 'file' ? 'Subí tu lista de precios' : 'Sacale una foto al remito'}
                  </h3>
                  
                  <p className="text-white/60 text-sm mb-8 mx-auto max-w-md">
                    {tab === 'file'
                      ? 'Se detectan columnas automáticamente (name, sku, barcode, cost_price, quantity, category).'
                      : 'Nuestra IA leerá el texto escrito a mano o impreso y extraerá los productos automáticamente.'}
                  </p>

                  <label className="inline-block relative">
                    <input
                      type="file"
                      accept={tab === 'file' ? ".csv,.xls,.xlsx" : "image/*"}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        tab === 'file' ? handleFileUpload(file) : handleOCRUpload(file)
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="px-8 py-4 rounded-2xl bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] text-white font-extrabold text-sm sm:text-base shadow-lg border border-white/20 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer">
                      Seleccionar {tab === 'file' ? 'Archivo' : 'Imagen'}
                    </div>
                  </label>
                </>
              )}
            </div>
          </div>
        )}

        {/* Vista Previa Table */}
        {products.length > 0 && !showAuditModal && (
          <div className="flex-1 flex flex-col h-full animate-fade-in-up">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
              <div>
                <h2 className="text-white text-xl font-extrabold drop-shadow">
                  Vista Previa
                </h2>
                <p className="text-white/70 text-sm mt-0.5">
                  Se detectaron {products.length} filas en {fileName}
                </p>
              </div>
              <button
                onClick={() => setShowAuditModal(true)}
                disabled={loading}
                className="shrink-0 px-6 py-3 rounded-2xl bg-white text-[#2F5E58] font-extrabold text-sm shadow-xl hover:scale-105 active:scale-95 transition-all"
              >
                Auditar y Guardar →
              </button>
            </div>

            <div className="flex-1 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              <div className="overflow-auto flex-1">
                <table className="min-w-full">
                  <thead className="sticky top-0 bg-white/10 backdrop-blur-xl border-b border-white/15 z-10">
                    <tr>
                      <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-white/70">Cant.</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70">Producto</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70">Código</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70">Rubro (IA)</th>
                      <th className="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-white/70">Costo Unit.</th>
                      <th className="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-white/70">Venta Unit.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {products.map((p, idx) => (
                      <tr key={p.barcode ?? p.sku ?? `${p.name}-${idx}`} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-white/10 text-white text-xs font-bold">
                            {p.quantity || 1}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-white font-semibold text-sm">{p.name}</div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-white/70">{p.sku || p.barcode || '-'}</td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 border border-white/15 text-white/80">
                            {p.category || 'otros'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm text-white/90">
                          {p.cost_price !== undefined && p.cost_price !== null ? `$${formatCurrency(p.cost_price)}` : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm text-white/90 font-bold">
                          {p.sale_price !== undefined && p.sale_price !== null ? `$${formatCurrency(p.sale_price)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-[#3D7373]/95 backdrop-blur-xl border-t border-white/20">
                    <tr>
                      <td className="px-4 py-3 text-center text-sm font-extrabold text-white">{totalUnits()}</td>
                      <td className="px-4 py-3 text-sm font-extrabold text-white">Totales de importación</td>
                      <td></td>
                      <td></td>
                      <td className="px-4 py-3 text-right text-sm font-extrabold text-white">
                        ${formatCurrency(totalCost())}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Auditoría */}
        {showAuditModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-5xl bg-white/15 backdrop-blur-2xl border border-white/30 rounded-[2rem] flex flex-col max-h-full shadow-2xl">
              
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-white/15 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-white text-xl font-extrabold drop-shadow">Auditoría de carga</h2>
                  <p className="text-white/70 text-sm mt-1">
                    Revisá cantidades, costos y rubros. Destildá los que no quieras ingresar.
                  </p>
                </div>
                <button
                  onClick={() => setShowAuditModal(false)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                {products.map((p, idx) => {
                  const isOmitted = !!omitMap[idx]
                  return (
                    <div
                      key={idx}
                      className={`relative flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                        isOmitted
                          ? 'bg-white/5 border-white/5 opacity-40 grayscale'
                          : 'bg-white/10 border-white/20 shadow-md'
                      }`}
                    >
                      <div className="pt-1">
                        <label className="relative flex cursor-pointer items-center rounded-full p-1">
                          <input
                            type="checkbox"
                            className="peer relative h-6 w-6 cursor-pointer appearance-none rounded-md border-2 border-white/30 transition-all checked:border-[#7FC7A8] checked:bg-[#7FC7A8]"
                            checked={!isOmitted}
                            onChange={() => toggleOmit(idx)}
                          />
                          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100 pointer-events-none">
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                            </svg>
                          </span>
                        </label>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-base mb-3 truncate">{p.name}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60">Cantidad</label>
                            <input
                              type="number"
                              min="1"
                              value={p.quantity || 1}
                              disabled={isOmitted}
                              onChange={(e) => {
                                const updated = [...products]
                                updated[idx] = { ...updated[idx], quantity: parseInt(e.target.value) || 1 }
                                setProducts(updated)
                              }}
                              className="w-full bg-black/20 border border-white/15 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-white/40 transition-all disabled:opacity-50"
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60">Rubro</label>
                            <select
                              value={toSlug(p.category || 'otros')}
                              disabled={isOmitted}
                              onChange={(e) => {
                                const updated = [...products]
                                updated[idx] = { ...updated[idx], category: e.target.value }
                                setProducts(updated)
                              }}
                              className="w-full bg-black/20 border border-white/15 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-white/40 transition-all disabled:opacity-50 appearance-none"
                            >
                              {categories.map((c) => (
                                <option key={c.id} value={toSlug(c.name)} className="text-gray-900">
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60">Costo Unit.</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50 text-xs">$</span>
                              <input
                                type="text"
                                disabled={isOmitted}
                                value={p.cost_price !== undefined && p.cost_price !== null ? String(p.cost_price) : ''}
                                onChange={(e) => {
                                  const num = normalizeNumber(e.target.value)
                                  const updated = [...products]
                                  updated[idx] = { ...updated[idx], cost_price: num }
                                  setProducts(updated)
                                }}
                                className="w-full pl-6 pr-2 bg-black/20 border border-white/15 text-white rounded-xl py-2 text-sm outline-none focus:border-white/40 transition-all disabled:opacity-50"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60">Venta Unit.</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50 text-xs">$</span>
                              <input
                                type="text"
                                disabled={isOmitted}
                                value={p.sale_price !== undefined && p.sale_price !== null ? String(p.sale_price) : ''}
                                onChange={(e) => {
                                  const num = normalizeNumber(e.target.value)
                                  const updated = [...products]
                                  updated[idx] = { ...updated[idx], sale_price: num }
                                  setProducts(updated)
                                }}
                                className="w-full pl-6 pr-2 bg-black/20 border border-white/15 text-white rounded-xl py-2 text-sm outline-none focus:border-white/40 transition-all disabled:opacity-50"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-5 border-t border-white/15 bg-black/20 rounded-b-[2rem] shrink-0">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  
                  <div className="flex-1 space-y-4">
                    {/* Resumen por rubro */}
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs font-bold text-white/50 uppercase tracking-wider mr-2 self-center">Resumen:</span>
                      {getCategorySummary().map(({ category, count }) => (
                        <span key={category} className="px-2.5 py-1 rounded-md bg-white/10 border border-white/10 text-white/80 text-xs font-semibold">
                          {category}: {count} un.
                        </span>
                      ))}
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={acceptedCheck}
                          onChange={(e) => setAcceptedCheck(e.target.checked)}
                          className="peer appearance-none w-5 h-5 border-2 border-white/40 rounded transition-all checked:bg-[#7FC7A8] checked:border-[#7FC7A8]"
                        />
                        <svg className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-white/80 text-sm font-medium group-hover:text-white transition-colors">
                        Revisé los detalles y acepto ingresar esta mercadería al stock.
                      </span>
                    </label>

                    {(error || success) && (
                      <div className={`text-sm font-bold ${error ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {error || success}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 shrink-0">
                    <button
                      onClick={() => setShowAuditModal(false)}
                      className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmSave}
                      disabled={saving || !acceptedCheck}
                      className="px-6 py-3 rounded-2xl bg-gradient-to-br from-[#7FC7A8] to-[#4E9B7C] text-white font-extrabold shadow-lg border border-white/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:grayscale transition-all"
                    >
                      {saving ? 'Guardando...' : 'Confirmar Importación'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}