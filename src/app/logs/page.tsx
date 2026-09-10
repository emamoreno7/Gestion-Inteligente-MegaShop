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

type ActivityEntry = {
  id: string
  user_name: string
  location_id: string
  action: string
  description: string
  details: any
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  login: 'Ingreso',
  caja: 'Caja',
  cobro: 'Cobro',
  venta: 'Venta',
  stock: 'Stock',
  precio: 'Precio',
}

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  caja: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  cobro: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  venta: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  stock: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  precio: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
}

export default function LogsPage() {
  const [tab, setTab] = useState<'errores' | 'actividad'>('errores')

  // Estado de errores
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Estado de actividad
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [loadingActivity, setLoadingActivity] = useState(false)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [activitySearch, setActivitySearch] = useState('')
  const [filterAction, setFilterAction] = useState('')

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

  const loadActivity = async () => {
    setLoadingActivity(true)
    setActivityError(null)
    try {
      const res = await fetch('/api/activity')
      const data = await res.json()
      if (!res.ok) {
        setActivityError(data.error || 'Error al cargar actividad')
      } else {
        setActivities(data.activities || [])
      }
    } catch {
      setActivityError('Error de red al cargar actividad')
    }
    setLoadingActivity(false)
  }

  useEffect(() => {
    if (tab === 'actividad' && activities.length === 0 && !loadingActivity && !activityError) {
      loadActivity()
    }
  }, [tab])

  const filtered = logs.filter(log => {
    const matchesSearch =
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      (log.route || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.user_name || '').toLowerCase().includes(search.toLowerCase())
    const matchesSource = filterSource === '' || log.source === filterSource
    return matchesSearch && matchesSource
  })

  const filteredActivities = activities.filter(a => {
    const needle = activitySearch.toLowerCase()
    const matchesSearch =
      needle === '' ||
      (a.description || '').toLowerCase().includes(needle) ||
      (a.user_name || '').toLowerCase().includes(needle) ||
      JSON.stringify(a.details || {}).toLowerCase().includes(needle)
    const matchesAction = filterAction === '' || a.action === filterAction
    return matchesSearch && matchesAction
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <Link href="/dashboard" className="text-blue-400 hover:underline">← Volver</Link>
      <h1 className="text-3xl font-bold mt-4 mb-4">Registros del sistema</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-700">
        <button
          onClick={() => setTab('errores')}
          className={`px-4 py-2 font-semibold rounded-t-lg transition-colors ${
            tab === 'errores'
              ? 'bg-gray-800 text-white border border-gray-700 border-b-transparent'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Errores
        </button>
        <button
          onClick={() => setTab('actividad')}
          className={`px-4 py-2 font-semibold rounded-t-lg transition-colors ${
            tab === 'actividad'
              ? 'bg-gray-800 text-white border border-gray-700 border-b-transparent'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Actividad de usuarios
        </button>
      </div>

      {tab === 'errores' ? (
        <>
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
        </>
      ) : (
        <>
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              placeholder="Buscar por usuario, acción o detalle..."
              value={activitySearch}
              onChange={(e) => setActivitySearch(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-3 py-2 flex-1"
            />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-3 py-2"
            >
              <option value="">Todas las acciones</option>
              <option value="login">Ingreso</option>
              <option value="caja">Caja</option>
              <option value="cobro">Cobro</option>
              <option value="venta">Venta</option>
              <option value="stock">Stock</option>
              <option value="precio">Precio</option>
            </select>
            <button
              onClick={loadActivity}
              className="px-3 py-2 bg-gray-800 border border-gray-600 rounded hover:bg-gray-700 transition-colors text-sm font-semibold"
            >
              Actualizar
            </button>
          </div>

          {loadingActivity ? (
            <p className="text-gray-400">Cargando...</p>
          ) : activityError ? (
            <p className="text-red-400">{activityError}</p>
          ) : filteredActivities.length === 0 ? (
            <div className="bg-gray-800 rounded p-8 text-center text-gray-400">
              No hay actividad registrada.
            </div>
          ) : (
            <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-2">
              {filteredActivities.map(a => {
                const colorClass = ACTION_COLORS[a.action] || 'bg-gray-600/20 text-gray-300 border-gray-600/30'
                return (
                  <div key={a.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4 hover:bg-gray-750 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${colorClass}`}>
                            {ACTION_LABELS[a.action] || a.action}
                          </span>
                          <p className="font-bold text-white break-words">{a.description}</p>
                        </div>
                        <div className="mt-1 text-sm text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                          <span>{new Date(a.created_at).toLocaleString('es-AR')}</span>
                          <span>· {a.user_name}</span>
                        </div>
                        {a.details && Object.keys(a.details).length > 0 && (
                          <pre className="mt-2 text-xs text-gray-400 bg-black/30 p-2 rounded-lg overflow-x-auto break-words">
                            {JSON.stringify(a.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}