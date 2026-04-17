import { useState, useEffect } from 'react'
import {
  FileText, Inbox, Eye, X, Monitor, Calendar, Hash,
  Edit3, Save, Plus, Trash2, CheckCircle2, AlertCircle,
  Gavel, Users, Clock, ListChecks, ShieldAlert, BookOpen,
  ChevronRight, FileDown, FileType,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { DEFAULT_FIELDS } from '../lib/aiDefaults'
import { generatePdf } from '../lib/generatePdf'
import type { ExtractionField, ReportConfig, ExcepcionConfig } from '../lib/generatePdf'
import { generateWord } from '../lib/generateWord'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface HistorialEntry {
  id: string
  codigo_aranzadi: string
  equipo: string | null
  documentos: string[] | null
  resultado: Record<string, unknown>
  created_at: string
}

interface HistoryPageProps { user: User }

// ── Secciones del editor ───────────────────────────────────────────────────
type EditorSection =
  | 'procedimiento'
  | 'partes'
  | 'vista'
  | 'acciones'
  | 'excepcion'
  | 'hechos'

interface SectionDef {
  id: EditorSection
  label: string
  shortLabel: string
  Icon: React.ElementType
  color: string
  bg: string
}

const SECTIONS: SectionDef[] = [
  { id: 'procedimiento', label: 'Datos del procedimiento', shortLabel: 'Procedimiento', Icon: Gavel,      color: '#2B58C4', bg: '#EEF2FF' },
  { id: 'partes',        label: 'Partes intervinientes',   shortLabel: 'Partes',        Icon: Users,      color: '#7C3AED', bg: '#F5F3FF' },
  { id: 'vista',         label: 'Vista procesal',          shortLabel: 'Vista',         Icon: Clock,      color: '#D97706', bg: '#FFFBEB' },
  { id: 'acciones',      label: 'Acciones ejercitadas',    shortLabel: 'Acciones',      Icon: ListChecks, color: '#059669', bg: '#ECFDF5' },
  { id: 'excepcion',     label: 'Excepción procesal',      shortLabel: 'Excepción',     Icon: ShieldAlert,color: '#DC2626', bg: '#FEF2F2' },
  { id: 'hechos',        label: 'Hechos controvertidos',   shortLabel: 'Hechos',        Icon: BookOpen,   color: '#0891B2', bg: '#ECFEFF' },
]

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function isoToEs(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](.+))?$/)
  if (!m) return s
  return m[4] ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}` : `${m[3]}-${m[2]}-${m[1]}`
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (Array.isArray(val)) return val.join(' · ')
  if (typeof val === 'number') return val.toLocaleString('es-ES')
  return isoToEs(String(val))
}

function toArray(val: unknown): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.map(String)
  return [String(val)]
}

// ── Componentes de campo ───────────────────────────────────────────────────
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</label>
      {children}
    </div>
  )
}

function TextFieldInput({ value, onChange, placeholder, mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? '—'}
      className={`w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 bg-white placeholder-gray-300 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/25 focus:border-[#2B58C4] transition ${mono ? 'font-mono' : ''}`}
    />
  )
}

function SelectFieldInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/25 focus:border-[#2B58C4] transition appearance-none cursor-pointer"
    >
      <option value="">— Sin especificar —</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// Lista editable de strings (acciones, excepciones, hechos)
function EditableList({ items, onChange, placeholder, accentColor }: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
  accentColor: string
}) {
  function update(i: number, val: string) {
    const next = [...items]
    next[i] = val
    onChange(next)
  }
  function remove(i: number) { onChange(items.filter((_, idx) => idx !== i)) }
  function add() { onChange([...items, '']) }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="flex-shrink-0 mt-2.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ backgroundColor: accentColor }}>
            {i + 1}
          </span>
          <textarea
            value={item}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder ?? 'Escribe aquí…'}
            rows={2}
            className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/25 focus:border-[#2B58C4] transition leading-relaxed"
          />
          <button onClick={() => remove(i)}
            className="flex-shrink-0 mt-2 p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition focus:outline-none">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button onClick={add}
        className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border border-dashed border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition w-full justify-center focus:outline-none">
        <Plus className="w-3.5 h-3.5" />
        Añadir elemento
      </button>
    </div>
  )
}

// ── Secciones del editor ───────────────────────────────────────────────────
function SectionProcedimiento({ data, onChange }: { data: Record<string, unknown>; onChange: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(data[k] ?? '')
  return (
    <div className="grid grid-cols-2 gap-5">
      <div className="col-span-2">
        <FieldGroup label="NIG — Número de Identificación General">
          <TextFieldInput value={g('NIG')} onChange={(v) => onChange('NIG', v)} placeholder="28079470120240012345" mono />
        </FieldGroup>
      </div>
      <FieldGroup label="Tipo de procedimiento">
        <SelectFieldInput value={g('procedimiento')} onChange={(v) => onChange('procedimiento', v)} options={[
          { value: 'Juicio Verbal',    label: 'Juicio Verbal' },
          { value: 'Juicio Ordinario', label: 'Juicio Ordinario' },
          { value: 'Monitorio',        label: 'Monitorio' },
          { value: 'Cambiario',        label: 'Cambiario' },
        ]} />
      </FieldGroup>
      <FieldGroup label="Número de autos">
        <TextFieldInput value={g('numero_autos')} onChange={(v) => onChange('numero_autos', v)} placeholder="456/2024" mono />
      </FieldGroup>
      <div className="col-span-2">
        <FieldGroup label="Juzgado competente">
          <TextFieldInput value={g('juzgado')} onChange={(v) => onChange('juzgado', v)} placeholder="Juzgado de 1.ª Instancia n.º 3 de Madrid" />
        </FieldGroup>
      </div>
      <FieldGroup label="Cuantía (€)">
        <TextFieldInput value={g('cuantia')} onChange={(v) => onChange('cuantia', v !== '' ? Number(v) || v : '')} placeholder="4823.50" mono />
      </FieldGroup>
      <FieldGroup label="Fecha presentación demanda">
        <TextFieldInput value={g('fecha_presentacion')} onChange={(v) => onChange('fecha_presentacion', v)} placeholder="2024-03-01" mono />
      </FieldGroup>
    </div>
  )
}

function SectionPartes({ data, onChange }: { data: Record<string, unknown>; onChange: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(data[k] ?? '')
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-5">
        <FieldGroup label="Demandante">
          <TextFieldInput value={g('demandante')} onChange={(v) => onChange('demandante', v)} placeholder="Nombre del demandante" />
        </FieldGroup>
        <FieldGroup label="Demandado">
          <TextFieldInput value={g('demandado')} onChange={(v) => onChange('demandado', v)} placeholder="Nombre del demandado" />
        </FieldGroup>
      </div>
      <div className="grid grid-cols-2 gap-5">
        <FieldGroup label="Procurador">
          <TextFieldInput value={g('procurador')} onChange={(v) => onChange('procurador', v)} placeholder="D.ª María Fernández Ruiz" />
        </FieldGroup>
        <FieldGroup label="Abogado / Letrado">
          <TextFieldInput value={g('abogado')} onChange={(v) => onChange('abogado', v)} placeholder="D. Carlos Martínez Pérez" />
        </FieldGroup>
      </div>
    </div>
  )
}

function SectionVista({ data, onChange }: { data: Record<string, unknown>; onChange: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(data[k] ?? '')
  return (
    <div className="grid grid-cols-2 gap-5">
      <FieldGroup label="Día de vista (ISO 8601)">
        <TextFieldInput value={g('dia_vista')} onChange={(v) => onChange('dia_vista', v)} placeholder="2024-11-15" mono />
      </FieldGroup>
      <FieldGroup label="Tipo de vista">
        <SelectFieldInput value={g('tipo_vista')} onChange={(v) => onChange('tipo_vista', v)} options={[
          { value: 'PRESENCIAL',  label: 'Presencial' },
          { value: 'TELEMÁTICA', label: 'Telemática' },
        ]} />
      </FieldGroup>
      <FieldGroup label="Inicio del acto">
        <SelectFieldInput value={g('inicio_acto')} onChange={(v) => onChange('inicio_acto', v)} options={[
          { value: 'AUDIENCIA_PREVIA', label: 'Audiencia previa' },
          { value: 'JUICIO',          label: 'Juicio' },
        ]} />
      </FieldGroup>
      <FieldGroup label="Teléfono de incidencias">
        <TextFieldInput value={g('telefono_incidencias')} onChange={(v) => onChange('telefono_incidencias', v)} placeholder="91 700 00 00" mono />
      </FieldGroup>
    </div>
  )
}

function SectionAcciones({ data, onChange }: { data: Record<string, unknown>; onChange: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 leading-relaxed">
        Resumen en bullets del <strong>SOLICITO</strong> de la demanda. Cada elemento es una acción ejercitada.
      </p>
      <EditableList
        items={toArray(data['acciones_ejercitadas'])}
        onChange={(items) => onChange('acciones_ejercitadas', items)}
        placeholder="Ej. Declarar la nulidad del contrato de tarjeta revolving por usura"
        accentColor="#059669"
      />
    </div>
  )
}

function SectionExcepcion({
  data,
  onChange,
  catalogo = [],
}: {
  data: Record<string, unknown>
  onChange: (k: string, v: unknown) => void
  catalogo?: ExcepcionConfig[]
}) {
  const items = toArray(data['excepciones_procesales'])

  // Determina si un nombre de catálogo está activo en la lista actual
  function isActive(nombre: string) {
    const n = nombre.trim().toLowerCase()
    return items.some((i) => i.trim().toLowerCase() === n || i.trim().toLowerCase().includes(n))
  }

  // Items libres: los que no coinciden con ningún catálogo
  const customItems = items.filter((item) =>
    !catalogo.some((c) => {
      const n = c.nombre.trim().toLowerCase()
      return item.trim().toLowerCase() === n || item.trim().toLowerCase().includes(n)
    })
  )

  function toggleCatalog(nombre: string) {
    if (isActive(nombre)) {
      // quitar: elimina el item que coincida
      const next = items.filter((i) => {
        const il = i.trim().toLowerCase()
        const nl = nombre.trim().toLowerCase()
        return il !== nl && !il.includes(nl)
      })
      onChange('excepciones_procesales', next.length ? next : null)
    } else {
      // añadir el nombre del catálogo
      onChange('excepciones_procesales', [...items, nombre])
    }
  }

  function updateCustom(newCustom: string[]) {
    // reconstruye: activos del catálogo + libres nuevos
    const catalogActivos = catalogo.filter((c) => isActive(c.nombre)).map((c) => c.nombre)
    const merged = [...catalogActivos, ...newCustom]
    onChange('excepciones_procesales', merged.length ? merged : null)
  }

  const noHay = items.length === 0

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
        <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-red-700 mb-0.5">Sección: Excepción procesal</p>
          <p className="text-[11px] text-red-600 leading-relaxed">
            Excepciones procesales o materiales alegadas por el demandado. Selecciona del catálogo o añade libremente.
          </p>
        </div>
      </div>

      {/* Catálogo */}
      {catalogo.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Del catálogo configurado</p>
          <div className="flex flex-wrap gap-2">
            {catalogo.map((c) => {
              const active = isActive(c.nombre)
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCatalog(c.nombre)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition focus:outline-none ${
                    active
                      ? 'bg-red-600 border-red-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600'
                  }`}
                >
                  <ShieldAlert className="w-3 h-3" />
                  {c.nombre}
                  {active && <CheckCircle2 className="w-3 h-3" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Toggle sin excepciones / libre */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
          {catalogo.length > 0 ? 'Excepciones personalizadas (texto libre)' : 'Excepciones procesales'}
        </p>
        {noHay && catalogo.length === 0 && (
          <button
            onClick={() => onChange('excepciones_procesales', [''])}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-semibold transition w-full focus:outline-none bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir excepción
          </button>
        )}
        <EditableList
          items={customItems}
          onChange={updateCustom}
          placeholder="Ej. Prescripción de la acción por transcurso del plazo legal"
          accentColor="#DC2626"
        />
      </div>

      {/* Estado: sin excepciones */}
      {noHay && (
        <p className="text-[11px] text-green-600 italic">
          Sin excepciones procesales alegadas.
        </p>
      )}
    </div>
  )
}

function SectionHechos({ data, onChange }: { data: Record<string, unknown>; onChange: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 leading-relaxed">
        Hechos de la demanda que el demandado <strong>niega, matiza o contradice</strong> en la contestación.
      </p>
      <EditableList
        items={toArray(data['hechos_controvertidos'])}
        onChange={(items) => onChange('hechos_controvertidos', items)}
        placeholder="Ej. El demandado niega que el tipo de interés sea usurario"
        accentColor="#0891B2"
      />
    </div>
  )
}

// ── Modal editor completo ──────────────────────────────────────────────────
function EditExpedienteModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: HistorialEntry
  onClose: () => void
  onSaved: (updated: HistorialEntry) => void
}) {
  const [activeSection, setActiveSection] = useState<EditorSection>('procedimiento')
  const [data,    setData]    = useState<Record<string, unknown>>({ ...entry.resultado })
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [aiFields,         setAiFields]         = useState<ExtractionField[]>(DEFAULT_FIELDS)
  const [reportCfg,        setReportCfg]        = useState<ReportConfig | null>(null)
  const [excepcionesConfig, setExcepcionesConfig] = useState<ExcepcionConfig[]>([])
  const [genError,         setGenError]         = useState<string | null>(null)

  // Carga config del usuario para la generación de informes
  useEffect(() => {
    supabase.from('ai_bias').select('fields').maybeSingle().then(({ data: d }) => {
      if (Array.isArray(d?.fields) && d.fields.length > 0) setAiFields(d.fields as ExtractionField[])
    })
    supabase.from('report_config').select('*').maybeSingle().then(({ data: d }) => {
      if (d) setReportCfg(d as ReportConfig)
    })
    supabase.from('excepciones_procesales').select('id, nombre, texto_asociado').then(({ data: d }) => {
      if (Array.isArray(d)) setExcepcionesConfig(d as ExcepcionConfig[])
    })
  }, [])

  function handleChange(key: string, value: unknown) {
    setSaved(false)
    setData((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true); setError(null)
    const { error: sbError } = await supabase
      .from('historial_analisis')
      .update({ resultado: data })
      .eq('id', entry.id)
    setSaving(false)
    if (sbError) { setError('No se pudo guardar. Inténtalo de nuevo.'); return }
    setSaved(true)
    onSaved({ ...entry, resultado: data })
    setTimeout(() => setSaved(false), 3000)
  }

  function handleDownloadPdf() {
    setGenError(null)
    try {
      const defaultSections = [
        { id: 'portada',     title: 'Portada',                subtitle: '', enabled: true },
        { id: 'timeline',    title: 'Cronología del asunto',  subtitle: '', enabled: true },
        { id: 'calendario',  title: 'Calendario procesal',    subtitle: '', enabled: true },
        { id: 'acciones',    title: 'Acciones ejercitadas',   subtitle: '', enabled: true },
        { id: 'excepciones', title: 'Excepciones procesales', subtitle: '', enabled: true },
        { id: 'hechos',      title: 'Hechos controvertidos',  subtitle: '', enabled: true },
        { id: 'datos',       title: 'Datos adicionales',      subtitle: '', enabled: false },
        { id: 'conclusiones',title: 'Conclusiones',           subtitle: '', enabled: false },
      ]
      const cfg: ReportConfig = reportCfg ?? {
        firm_name: '', firm_tagline: '', firm_address: '',
        firm_phone: '', firm_email: '', firm_web: '',
        footer_text: 'Documento generado automáticamente por ONLY8H · Confidencial',
        primary_color: '#2B58C4', secondary_color: '#F8FAFC',
        font_size: 'normal', sections: defaultSections,
      }
      generatePdf(data, aiFields, cfg, excepcionesConfig)
    } catch {
      setGenError('No se pudo generar el PDF.')
    }
  }

  async function handleDownloadWord() {
    setGenError(null)
    try {
      await generateWord(data, aiFields, entry.codigo_aranzadi, reportCfg?.firm_name, excepcionesConfig, reportCfg ?? undefined)
    } catch {
      setGenError('No se pudo generar el Word.')
    }
  }

  const sec = SECTIONS.find((s) => s.id === activeSection)!

  return (
    <div className="fixed inset-0 z-50 flex items-stretch">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel editor */}
      <div className="relative ml-auto w-full max-w-3xl bg-white flex flex-col h-full shadow-2xl">

        {/* ── Cabecera ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
              <Edit3 className="w-4 h-4 text-[#2B58C4]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Editar expediente</p>
              <p className="text-sm font-bold text-gray-900 font-mono truncate">{entry.codigo_aranzadi}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(error || genError) && (
              <span className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />{error ?? genError}
              </span>
            )}

            {/* Descargar Word */}
            <button
              onClick={handleDownloadWord}
              title="Descargar informe Word (.docx)"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1D4ED8] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1"
            >
              <FileType className="w-3.5 h-3.5" />
              Word
            </button>

            {/* Descargar PDF */}
            <button
              onClick={handleDownloadPdf}
              title="Descargar informe PDF"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-1"
            >
              <FileDown className="w-3.5 h-3.5" />
              PDF
            </button>

            <div className="w-px h-6 bg-gray-200 mx-1" />

            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                saved
                  ? 'bg-green-50 text-green-700 border border-green-200 focus:ring-green-400'
                  : 'bg-[#2B58C4] hover:bg-[#2348A8] text-white focus:ring-[#2B58C4] disabled:opacity-60 disabled:cursor-not-allowed'
              }`}
            >
              {saving ? (
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar cambios'}
            </button>
            <button onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition focus:outline-none">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Cuerpo con sidebar + contenido ── */}
        <div className="flex flex-1 min-h-0">

          {/* Sidebar de secciones */}
          <nav className="w-52 flex-shrink-0 border-r border-gray-100 py-4 overflow-y-auto bg-gray-50/50">
            {SECTIONS.map((s) => {
              const active = s.id === activeSection
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition focus:outline-none group ${
                    active ? 'bg-white border-r-2 border-[#2B58C4]' : 'hover:bg-white/70'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{
                      backgroundColor: active ? s.bg : 'transparent',
                    }}>
                    <s.Icon className="w-3.5 h-3.5 transition-colors"
                      style={{ color: active ? s.color : '#9CA3AF' }} />
                  </div>
                  <span className={`text-xs font-semibold truncate transition-colors ${
                    active ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'
                  }`}>
                    {s.shortLabel}
                  </span>
                  {active && <ChevronRight className="w-3 h-3 text-[#2B58C4] ml-auto flex-shrink-0" />}
                </button>
              )
            })}
          </nav>

          {/* Área de contenido */}
          <div className="flex-1 overflow-y-auto p-7">
            {/* Título de sección */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: sec.bg }}>
                <sec.Icon className="w-4 h-4" style={{ color: sec.color }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">{sec.label}</h3>
                <p className="text-[11px] text-gray-400">Código: <span className="font-mono">{entry.codigo_aranzadi}</span></p>
              </div>
            </div>

            {/* Sección activa */}
            {activeSection === 'procedimiento' && <SectionProcedimiento data={data} onChange={handleChange} />}
            {activeSection === 'partes'        && <SectionPartes        data={data} onChange={handleChange} />}
            {activeSection === 'vista'         && <SectionVista         data={data} onChange={handleChange} />}
            {activeSection === 'acciones'      && <SectionAcciones      data={data} onChange={handleChange} />}
            {activeSection === 'excepcion'     && <SectionExcepcion     data={data} onChange={handleChange} catalogo={excepcionesConfig} />}
            {activeSection === 'hechos'        && <SectionHechos        data={data} onChange={handleChange} />}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal de solo lectura ──────────────────────────────────────────────────
function ExpedienteModal({ entry, onClose, onEdit }: {
  entry: HistorialEntry
  onClose: () => void
  onEdit: () => void
}) {
  const fieldMap = Object.fromEntries(DEFAULT_FIELDS.map((f) => [f.key, f.label]))
  const rows = Object.entries(entry.resultado).filter(([, v]) => v !== null && v !== undefined)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-[#2B58C4]" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Código Aranzadi</p>
              <p className="text-base font-bold text-gray-900 font-mono">{entry.codigo_aranzadi}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2B58C4] border border-[#2B58C4]/30 rounded-lg hover:bg-[#2B58C4] hover:text-white hover:border-[#2B58C4] transition focus:outline-none">
              <Edit3 className="w-3.5 h-3.5" />
              Editar
            </button>
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition focus:outline-none">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-5 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            {formatDate(entry.created_at)}
          </span>
          {entry.equipo && (
            <span className="flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5 text-gray-400" />
              {entry.equipo}
            </span>
          )}
          {entry.documentos?.length && (
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              {entry.documentos.length} doc{entry.documentos.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Datos */}
        <div className="overflow-y-auto flex-1 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-4">Datos extraídos</p>
          <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {rows.map(([key, value]) => (
              <div key={key} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <span className="flex-shrink-0 w-44 text-[11px] font-semibold text-[#2B58C4] pt-0.5">
                  {fieldMap[key] ?? key}
                </span>
                <span className="flex-1 text-xs text-gray-700 leading-relaxed">{formatValue(value)}</span>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-gray-400">Sin datos extraídos.</div>
            )}
          </div>

          {entry.documentos && entry.documentos.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Documentos analizados</p>
              <ul className="space-y-1.5">
                {entry.documentos.map((doc, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
          <button onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-[#2B58C4] hover:bg-[#2348A8] rounded-xl transition focus:outline-none">
            <Edit3 className="w-4 h-4" />Editar expediente
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition focus:outline-none">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Fila tabla ─────────────────────────────────────────────────────────────
function HistoryRow({ entry, onView, onEdit }: {
  entry: HistorialEntry
  onView: () => void
  onEdit: () => void
}) {
  const demandante = entry.resultado['demandante'] as string | undefined
  const demandado  = entry.resultado['demandado']  as string | undefined
  const titulo = demandante && demandado
    ? `${demandante} vs. ${demandado}`
    : demandante ?? demandado ?? '—'

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/70 transition-colors">
      <td className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5 w-8 h-8 bg-[#2B58C4]/10 rounded-lg flex items-center justify-center">
            <Hash className="w-4 h-4 text-[#2B58C4]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 font-mono leading-tight">{entry.codigo_aranzadi}</p>
            <p className="text-xs text-gray-400 truncate max-w-[240px] mt-0.5">{titulo}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <Monitor className="w-3.5 h-3.5 text-gray-400" />
          {entry.equipo ?? '—'}
        </span>
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          {formatDate(entry.created_at)}
        </span>
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-2">
          <button onClick={onView}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition focus:outline-none">
            <Eye className="w-3.5 h-3.5" />Ver
          </button>
          <button onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2B58C4] border border-[#2B58C4]/30 rounded-lg hover:bg-[#2B58C4] hover:text-white hover:border-[#2B58C4] transition focus:outline-none">
            <Edit3 className="w-3.5 h-3.5" />Editar
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Inbox className="w-7 h-7 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-700 mb-1">Sin análisis todavía</h3>
      <p className="text-sm text-gray-400 max-w-xs">
        Cuando realices tu primer análisis aparecerá aquí con el código Aranzadi del expediente.
      </p>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function HistoryPage({ user }: HistoryPageProps) {
  const [entries,  setEntries]  = useState<HistorialEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [viewing,  setViewing]  = useState<HistorialEntry | null>(null)
  const [editing,  setEditing]  = useState<HistorialEntry | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('historial_analisis')
        .select('id, codigo_aranzadi, equipo, documentos, resultado, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setEntries((data as HistorialEntry[]) ?? [])
      setLoading(false)
    }
    load()
  }, [user.id])

  function handleSaved(updated: HistorialEntry) {
    setEntries((prev) => prev.map((e) => e.id === updated.id ? updated : e))
    setEditing(updated)   // mantiene el editor abierto con datos frescos
  }

  return (
    <>
      {/* Modal lectura */}
      {viewing && !editing && (
        <ExpedienteModal
          entry={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null) }}
        />
      )}

      {/* Editor completo */}
      {editing && (
        <EditExpedienteModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      <div className="px-8 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Historial de análisis</h2>
            <p className="text-sm text-gray-500 mt-0.5">Todos los expedientes analizados por el equipo</p>
          </div>
          {!loading && entries.length > 0 && (
            <span className="text-sm text-gray-400">
              {entries.length} expediente{entries.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-[#2B58C4]/20 border-t-[#2B58C4] animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <EmptyState />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Historial de análisis">
                <thead>
                  <tr className="bg-gray-50">
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Expediente</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Equipo</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th scope="col" className="px-5 py-3"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <HistoryRow
                      key={entry.id}
                      entry={entry}
                      onView={() => setViewing(entry)}
                      onEdit={() => setEditing(entry)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
