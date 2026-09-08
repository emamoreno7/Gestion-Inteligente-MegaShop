'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 border border-gray-600 rounded px-3 py-2"
        />
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="bg-gray-800 border border-gray-600 rounded px-3 py-2">
          <option value="">Todos</option>
          <option value="frontend">Frontend</option>
          <option value="backend">Backend</option>
        </select>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : filtered.length === 0 ? (
        <p>No hay errores.</p>
      ) : (
        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
          {filtered.map(log => (
            <div key={log.id} className="p-3 bg-gray-800 rounded border border-gray-700">
              <div className="flex justify-between">
                <span className="font-bold">{log.message}</span>
                <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString('es-AR')}</span>
              </div>
              <div className="text-sm text-gray-300">
                {log.user_name} · {log.source} · {log.route}
              </div>
              {log.stack && <pre className="mt-2 text-xs text-red-300 bg-gray-900 p-2 rounded overflow-x-auto">{log.stack}</pre>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}