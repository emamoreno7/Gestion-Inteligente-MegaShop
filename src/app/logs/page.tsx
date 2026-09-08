'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type LogEntry = {
  id: string
  user_name: string
  location_id: string
  source: string
  message: string
  stack: string | null
  route: string | null
  metadata: any
  created_at: string
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await fetch('/api/logs')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al cargar logs')
      } else {
        setLogs(data.logs || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = logs.filter(log => {
    const matchesSearch =
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      (log.route || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.user_name || '').toLowerCase().includes(search.toLowerCase())
    const matchesSource = filterSource === '' || log.source === filterSource
    return matchesSearch && matchesSource
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <Link href="/dashboard" className="text-blue-400 hover:underline">← Volver</Link>
      <h1 className="text-3xl font-bold mt-4 mb-4">Registro de errores</h1>

      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Buscar por mensaje, ruta o usuario..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 border border-gray-600 rounded px-3 py-2 flex-1"
        />
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="bg-gray-800 border border-gray-600 rounded px-3 py-2"
        >
          <option value="">Todos</option>
          <option value="frontend">Frontend</option>
          <option value="backend">Backend</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-800 rounded p-8 text-center text-gray-400">
          No hay errores registrados.
        </div>
      ) : (
        <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-2">
          {filtered.map(log => {
            const isExpanded = expandedId === log.id
            return (
              <div key={log.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4 hover:bg-gray-750 transition-colors">
                <div
                  className="cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white break-words">{log.message}</p>
                      <div className="mt-1 text-sm text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                        <span>{new Date(log.created_at).toLocaleString('es-AR')}</span>
                        <span>· {log.user_name}</span>
                        <span>· {log.source}</span>
                        {log.route && <span>· {log.route}</span>}
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-500 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {isExpanded && log.stack && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Detalle técnico</p>
                    <pre className="text-xs text-red-300 bg-black/40 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-words">{log.stack}</pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}