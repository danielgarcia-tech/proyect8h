import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Page } from '../App'
import {
  FilePlus2,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  History,
  Settings,
} from 'lucide-react'

interface Props {
  onNavigate: (p: Page) => void
}

interface RecentEntry {
  id: string
  created_at: string
  codigo_aranzadi: string
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

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function todayLabel() {
  const raw = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date())
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export default function DashboardPage({ onNavigate }: Props) {
  const [stats, setStats]       = useState<Stats>({ total: 0, este_mes: 0, documentos_procesados: 0 })
  const [recent, setRecent]     = useState<RecentEntry[]>([])
  const [loading, setLoading]   = useState(true)
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: rows } = await supabase
        .from('historial_analisis')
        .select('id, created_at, codigo_aranzadi, documentos')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!rows) return

      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const esteMes   = rows.filter(r => r.created_at >= inicioMes).length
      const docCount  = rows.reduce((sum, r) => sum + (Array.isArray(r.documentos) ? r.documentos.length : 0), 0)

      setStats({ total: rows.length, este_mes: esteMes, documentos_procesados: docCount })
      setRecent(
        rows.slice(0, 5).map(r => ({
          id:              r.id,
          created_at:      r.created_at,
          codigo_aranzadi: r.codigo_aranzadi ?? 'Sin código',
          n_docs:          Array.isArray(r.documentos) ? r.documentos.length : 0,
        }))
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-[#F0F4FA]">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#162B6E] via-[#1E3A8A] to-[#2563EB]">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/[0.04]" />
        <div className="absolute top-6 right-52 w-36 h-36 rounded-full bg-white/[0.04]" />
        <div className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full bg-white/[0.04]" />

        <div className="relative px-10 pt-10 pb-9">
          {/* Saludo + CTA */}
          <div className="flex items-start justify-between gap-6 mb-8">
            <div>
              <p className="text-blue-300 text-[11px] font-semibold tracking-[0.12em] uppercase mb-2">
                {todayLabel()}
              </p>
              <h1 className="text-[2rem] font-bold text-white leading-tight">
                {greeting()},&nbsp;
                <span className="capitalize">{userName || '—'}</span>
              </h1>
              <p className="text-blue-300/80 text-sm mt-1.5">
                Panel de control · ONLY8H · RUA Abogados
              </p>
            </div>

            <button
              onClick={() => onNavigate('new-analysis')}
              className="flex items-center gap-2 bg-white text-[#1E3A8A] px-5 py-3 rounded-xl font-semibold text-sm
                         hover:bg-blue-50 active:scale-[0.97] transition-all shadow-2xl shadow-blue-950/40 shrink-0 mt-1"
            >
              <FilePlus2 className="w-4 h-4" />
              Nuevo análisis
              <ArrowRight className="w-4 h-4 opacity-70" />
            </button>
          </div>

          {/* Stats glass */}
          <div className="grid grid-cols-3 gap-3">
            <StatGlass label="Análisis totales"       value={loading ? '—' : String(stats.total)} />
            <StatGlass label="Este mes"               value={loading ? '—' : String(stats.este_mes)} />
            <StatGlass label="Documentos procesados"  value={loading ? '—' : String(stats.documentos_procesados)} />
          </div>
        </div>
      </div>

      {/* ── Contenido ────────────────────────────────────────────────────── */}
      <div className="px-10 py-8 max-w-4xl space-y-5">

        {/* Análisis recientes */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-[#1E293B]">Análisis recientes</h2>
            {recent.length > 0 && (
              <button
                onClick={() => onNavigate('history')}
                className="text-[12px] text-[#2563EB] hover:underline flex items-center gap-1 font-medium"
              >
                Ver todos <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-[68px] bg-white rounded-2xl border border-slate-100 animate-pulse" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState onNavigate={onNavigate} />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {recent.map((r, idx) => (
                <div
                  key={r.id}
                  className={`px-5 py-4 flex items-center gap-4 hover:bg-slate-50/70 transition-colors ${
                    idx !== 0 ? 'border-t border-slate-50' : ''
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#2563EB]/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F172A] truncate">{r.codigo_aranzadi}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {r.n_docs} documento{r.n_docs !== 1 ? 's' : ''} · {formatDate(r.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-emerald-700 bg-emerald-50
                                   border border-emerald-100 px-2.5 py-1 rounded-full leading-none">
                    Completado
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Accesos directos */}
        <div className="grid grid-cols-2 gap-3">
          <Shortcut
            icon={<History className="w-5 h-5 text-[#2563EB]" />}
            iconBg="bg-[#2563EB]/10"
            title="Historial completo"
            desc="Consulta y descarga informes anteriores"
            onClick={() => onNavigate('history')}
          />
          <Shortcut
            icon={<Settings className="w-5 h-5 text-amber-600" />}
            iconBg="bg-amber-50"
            title="Configuración"
            desc="IA, plantillas de informe y preferencias"
            onClick={() => onNavigate('settings')}
          />
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatGlass({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.11] backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-4">
      <p className="text-[1.75rem] font-bold text-white tabular-nums leading-none">{value}</p>
      <p className="text-blue-200/80 text-[11px] mt-2 font-medium">{label}</p>
    </div>
  )
}

function Shortcut({ icon, iconBg, title, desc, onClick }: {
  icon: React.ReactNode; iconBg: string; title: string; desc: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4
                 flex items-center gap-4 hover:border-[#2563EB]/20 hover:shadow-md transition text-left"
    >
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[#0F172A]">{title}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2563EB] transition shrink-0" />
    </button>
  )
}

function EmptyState({ onNavigate }: { onNavigate: (p: Page) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-[13px] font-semibold text-[#0F172A]">Aún no hay análisis</p>
      <p className="text-[12px] text-slate-400 mt-1">
        Crea tu primer análisis para verlo reflejado aquí
      </p>
      <button
        onClick={() => onNavigate('new-analysis')}
        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] text-white
                   text-[12px] font-semibold rounded-xl hover:bg-[#1E3A8A] transition
                   shadow-md shadow-blue-200"
      >
        <FilePlus2 className="w-3.5 h-3.5" />
        Empezar ahora
      </button>
    </div>
  )
}
