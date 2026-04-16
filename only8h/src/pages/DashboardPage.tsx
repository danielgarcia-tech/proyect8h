import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Page } from '../App'
import {
  FilePlus2,
  FileText,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react'

interface Props {
  onNavigate: (p: Page) => void
}

interface RecentAnalysis {
  id: string
  created_at: string
  titulo: string
  n_docs: number
}

interface Stats {
  total: number
  este_mes: number
  documentos_procesados: number
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(iso))
}

export default function DashboardPage({ onNavigate }: Props) {
  const [stats, setStats]   = useState<Stats>({ total: 0, este_mes: 0, documentos_procesados: 0 })
  const [recent, setRecent] = useState<RecentAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserName(user.email.split('@')[0])
    })
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Sesiones totales del usuario
      const { data: sesiones } = await supabase
        .from('instructas_sesiones')
        .select('id, created_at, titulo')
        .eq('estado', 'completado')
        .order('created_at', { ascending: false })

      if (!sesiones) { setLoading(false); return }

      const now = new Date()
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const esteMes = sesiones.filter(s => s.created_at >= inicioMes).length

      // Documentos procesados
      const ids = sesiones.map(s => s.id)
      let docCount = 0
      if (ids.length > 0) {
        const { count } = await supabase
          .from('instructas_documentos')
          .select('id', { count: 'exact', head: true })
          .in('sesion_id', ids)
        docCount = count ?? 0
      }

      // Análisis recientes (últimos 4)
      const recentData: RecentAnalysis[] = await Promise.all(
        sesiones.slice(0, 4).map(async (s) => {
          const { count } = await supabase
            .from('instructas_documentos')
            .select('id', { count: 'exact', head: true })
            .eq('sesion_id', s.id)
          return { id: s.id, created_at: s.created_at, titulo: s.titulo, n_docs: count ?? 0 }
        })
      )

      setStats({ total: sesiones.length, este_mes: esteMes, documentos_procesados: docCount })
      setRecent(recentData)
    } finally {
      setLoading(false)
    }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 20) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <div className="px-8 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0F172A]">
          {greeting()}, <span className="capitalize">{userName}</span>
        </h1>
        <p className="text-sm text-[#64748B] mt-1">
          Panel de control · ONLY8H · RUA Abogados
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<FileText className="w-5 h-5 text-[#2B58C4]" />}
          label="Análisis totales"
          value={loading ? '—' : String(stats.total)}
          bg="bg-[#2B58C4]/8"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          label="Este mes"
          value={loading ? '—' : String(stats.este_mes)}
          bg="bg-emerald-50"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          label="Docs. procesados"
          value={loading ? '—' : String(stats.documentos_procesados)}
          bg="bg-amber-50"
        />
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-3">
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickAction
            icon={<FilePlus2 className="w-5 h-5 text-[#2B58C4]" />}
            title="Nuevo análisis"
            desc="Sube documentos y genera un informe"
            onClick={() => onNavigate('new-analysis')}
            highlight
          />
          <QuickAction
            icon={<Clock className="w-5 h-5 text-[#64748B]" />}
            title="Ver historial"
            desc="Consulta y descarga análisis anteriores"
            onClick={() => onNavigate('history')}
          />
        </div>
      </div>

      {/* Tipos de documento soportados */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-3">
          Tipos de documento admitidos
        </h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {DOC_TYPES.map(dt => (
              <div key={dt.label} className="flex items-center gap-2.5 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span className={`w-2 h-2 rounded-full shrink-0 ${dt.color}`} />
                <span className="text-sm font-medium text-[#0F172A]">{dt.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#94A3B8] mt-3">
            Formatos de archivo: <span className="font-medium">PDF · DOCX</span>
          </p>
        </div>
      </div>

      {/* Análisis recientes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider">
            Análisis recientes
          </h2>
          {recent.length > 0 && (
            <button
              onClick={() => onNavigate('history')}
              className="text-xs text-[#2B58C4] hover:underline flex items-center gap-1"
            >
              Ver todos <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-16 bg-white rounded-xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-[#64748B]">Aún no hay análisis</p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Crea tu primer análisis para verlo aquí
            </p>
            <button
              onClick={() => onNavigate('new-analysis')}
              className="mt-4 px-4 py-2 bg-[#2B58C4] text-white text-xs font-semibold rounded-lg hover:bg-[#2040A8] transition"
            >
              Empezar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map(r => (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4"
              >
                <div className="w-8 h-8 rounded-lg bg-[#2B58C4]/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-[#2B58C4]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] truncate">{r.titulo}</p>
                  <p className="text-xs text-[#94A3B8]">
                    {r.n_docs} doc{r.n_docs !== 1 ? 's' : ''} · {formatDate(r.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────
function StatCard({ icon, label, value, bg }: {
  icon: React.ReactNode; label: string; value: string; bg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-[#0F172A]">{value}</p>
        <p className="text-xs text-[#64748B]">{label}</p>
      </div>
    </div>
  )
}

function QuickAction({ icon, title, desc, onClick, highlight = false }: {
  icon: React.ReactNode; title: string; desc: string
  onClick: () => void; highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left px-5 py-4 rounded-xl border shadow-sm flex items-center gap-4 transition group ${
        highlight
          ? 'bg-[#2B58C4] border-[#2B58C4] hover:bg-[#2040A8]'
          : 'bg-white border-gray-100 hover:border-[#2B58C4]/30 hover:shadow-md'
      }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
        highlight ? 'bg-white/20' : 'bg-[#2B58C4]/8'
      }`}>
        {highlight
          ? <FilePlus2 className="w-5 h-5 text-white" />
          : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${highlight ? 'text-white' : 'text-[#0F172A]'}`}>{title}</p>
        <p className={`text-xs mt-0.5 ${highlight ? 'text-white/70' : 'text-[#64748B]'}`}>{desc}</p>
      </div>
      <ChevronRight className={`w-4 h-4 shrink-0 ${highlight ? 'text-white/60' : 'text-[#94A3B8]'}`} />
    </button>
  )
}

// ── Tipos de documento ──────────────────────────────────────────────────────
export const DOC_TYPES: { label: string; color: string }[] = [
  { label: 'Demanda',          color: 'bg-red-400' },
  { label: 'Contestación',     color: 'bg-blue-400' },
  { label: 'Emplazamiento',    color: 'bg-amber-400' },
  { label: 'Sentencia',        color: 'bg-purple-400' },
  { label: 'Auto',             color: 'bg-teal-400' },
  { label: 'Escrito procesal', color: 'bg-gray-400' },
]
