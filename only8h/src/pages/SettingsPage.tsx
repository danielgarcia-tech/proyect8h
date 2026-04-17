import { useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { DEFAULT_FIELDS, DEFAULT_SYSTEM_PROMPT } from '../lib/aiDefaults'
import {
  DEFAULT_FIELD_SECTIONS, SPECIAL_LIST_KEYS,
} from '../lib/generatePdf'
import type { FieldSections, ExtractionField as PdfExtractionField } from '../lib/generatePdf'
import {
  User as UserIcon,
  Building2,
  SlidersHorizontal,
  Bell,
  Sparkles,
  FileBarChart2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Save,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  RotateCcw,
  Info,
  MessageSquareText,
  Palette,
  LayoutList,
  Monitor,
  Globe,
  Phone,
  Mail,
  MapPin,
  ShieldAlert,
  Pencil,
  Check,
  X,
  Layers,
  GripVertical,
  Users,
  Calendar,
  Gavel,
} from 'lucide-react'

interface SettingsPageProps { user: User }

// ── Secciones de navegación ────────────────────────────────────────────────
type Section = 'cuenta' | 'firma' | 'ia' | 'informe' | 'excepciones' | 'analisis' | 'notificaciones'
interface SectionItem { id: Section; label: string; description: string; Icon: React.ElementType }

const SECTIONS: SectionItem[] = [
  { id: 'cuenta',         label: 'Cuenta',                  description: 'Email, contraseña y sesión',                         Icon: UserIcon },
  { id: 'firma',          label: 'Datos de la firma',        description: 'Nombre, NIF y datos del despacho',                  Icon: Building2 },
  { id: 'ia',             label: 'Inteligencia Artificial',  description: 'Modelo, prompt y extracción JSON',                  Icon: Sparkles },
  { id: 'informe',        label: 'Informe PDF',              description: 'Plantilla, secciones y estilo del PDF',             Icon: FileBarChart2 },
  { id: 'excepciones',    label: 'Excepciones procesales',   description: 'Catálogo de excepciones y su texto en el informe',  Icon: ShieldAlert },
  { id: 'analisis',       label: 'Preferencias',             description: 'Idioma, detalle y formato del informe',             Icon: SlidersHorizontal },
  { id: 'notificaciones', label: 'Notificaciones',           description: 'Alertas y avisos por email',                        Icon: Bell },
]

// ── Tipos para el informe PDF ──────────────────────────────────────────────
interface ReportSection {
  id: string
  title: string
  subtitle: string
  enabled: boolean
}

const DEFAULT_REPORT_SECTIONS: ReportSection[] = [
  { id: 'portada',      title: 'Portada',                   subtitle: 'NIG, juzgado, cuantía y partes (2 columnas)',       enabled: true },
  { id: 'timeline',     title: 'Cronología del asunto',     subtitle: 'Timeline visual con las fechas clave del expediente', enabled: true },
  { id: 'calendario',   title: 'Calendario procesal',       subtitle: 'Tipo de vista, acto y teléfono de incidencias',     enabled: true },
  { id: 'acciones',     title: 'Acciones ejercitadas',      subtitle: 'Resumen en bullets del SOLICITO de la demanda',     enabled: true },
  { id: 'excepciones',  title: 'Excepciones procesales',    subtitle: 'Excepciones alegadas por el demandado',             enabled: true },
  { id: 'hechos',       title: 'Hechos controvertidos',     subtitle: 'Hechos que el demandado niega o matiza',            enabled: true },
  { id: 'datos',        title: 'Datos adicionales',         subtitle: 'Campos extra no incluidos en otras secciones',      enabled: false },
  { id: 'conclusiones', title: 'Conclusiones',              subtitle: 'Valoración jurídica y recomendaciones finales',     enabled: true },
]

// ── Campos de extracción ───────────────────────────────────────────────────
interface ExtractionField {
  id: string
  key: string
  label: string
  context: string   // explicación de contexto para la IA
  enabled: boolean
}


// ── Componentes reutilizables ──────────────────────────────────────────────
function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-gray-600 mb-1.5">
      {children}
    </label>
  )
}

function TextInput({ id, value, onChange, type = 'text', placeholder, disabled }: {
  id?: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; disabled?: boolean
}) {
  return (
    <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled}
      className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 bg-white placeholder-gray-300 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/30 focus:border-[#2B58C4] transition disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed" />
  )
}

function SelectInput({ id, value, onChange, options }: {
  id?: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/30 focus:border-[#2B58C4] transition appearance-none cursor-pointer">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 border-b border-gray-100 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 mt-0.5 w-9 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/40 focus:ring-offset-1 ${checked ? 'bg-[#2B58C4]' : 'bg-gray-200'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

function SaveButton({ onClick, saved }: { onClick: () => void; saved: boolean }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-[#2B58C4] focus:ring-offset-2 ${
        saved ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-[#2B58C4] hover:bg-[#2348A8] text-white'
      }`}>
      <Save className="w-4 h-4" />
      {saved ? 'Guardado' : 'Guardar cambios'}
    </button>
  )
}

// ── Fila de campo expandible ───────────────────────────────────────────────
function FieldRow({
  field, expanded, onToggleExpand, onToggleEnabled, onChangeContext, onRemove,
}: {
  field: ExtractionField
  expanded: boolean
  onToggleExpand: () => void
  onToggleEnabled: () => void
  onChangeContext: (v: string) => void
  onRemove: () => void
}) {
  const hasContext = field.context.trim().length > 0

  return (
    <div className={`transition-colors ${field.enabled ? 'bg-white' : 'bg-gray-50/60'}`}>
      {/* Fila principal */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Toggle activo/inactivo */}
        <button role="switch" aria-checked={field.enabled} onClick={onToggleEnabled}
          className={`relative flex-shrink-0 w-8 h-4 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/30 ${field.enabled ? 'bg-[#2B58C4]' : 'bg-gray-200'}`}>
          <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${field.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>

        {/* Clave JSON */}
        <code className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md w-40 flex-shrink-0 truncate ${
          field.enabled ? 'bg-[#EEF2FF] text-[#2B58C4]' : 'bg-gray-100 text-gray-400'
        }`}>
          {field.key}
        </code>

        {/* Label */}
        <span className={`flex-1 text-xs truncate min-w-0 ${field.enabled ? 'text-gray-700' : 'text-gray-400'}`}>
          {field.label}
        </span>

        {/* Indicador de contexto */}
        <div className={`flex-shrink-0 flex items-center gap-0.5 text-[10px] font-medium mr-1 ${
          hasContext ? 'text-[#2B58C4]' : 'text-gray-300'
        }`}>
          <MessageSquareText className="w-3.5 h-3.5" />
        </div>

        {/* Expandir */}
        <button onClick={onToggleExpand} aria-label={expanded ? 'Contraer' : 'Editar contexto'}
          className={`flex-shrink-0 p-1 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-[#2B58C4]/40 ${
            expanded ? 'bg-[#EEF2FF] text-[#2B58C4]' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
          }`}>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Eliminar */}
        <button onClick={onRemove} aria-label={`Eliminar ${field.key}`}
          className="flex-shrink-0 p-1 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors focus:outline-none">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Panel de contexto expandido */}
      {expanded && (
        <div className="px-4 pb-3 pt-0">
          <div className="ml-[4.5rem] pl-0">
            <div className="flex items-start gap-1.5 mb-1.5">
              <MessageSquareText className="w-3 h-3 text-[#2B58C4] mt-0.5 flex-shrink-0" />
              <p className="text-[10px] font-semibold text-[#2B58C4]">
                Contexto para la IA
              </p>
            </div>
            <textarea
              value={field.context}
              onChange={(e) => onChangeContext(e.target.value)}
              placeholder="Explica a la IA qué es este concepto, dónde buscarlo y cómo debe devolverlo…"
              rows={3}
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-[#C7D7F5] bg-[#F5F8FF] text-gray-700 placeholder-gray-300 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/30 focus:border-[#2B58C4] transition"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Este texto se incluye en el prompt junto a la clave para orientar al modelo.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sección IA ─────────────────────────────────────────────────────────────
function IASection({ user }: { user: User }) {
  const [model,        setModel]        = useState('claude-sonnet-4-6')
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT)
  const [fields,       setFields]       = useState<ExtractionField[]>(DEFAULT_FIELDS)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [newKey,       setNewKey]       = useState('')
  const [newLabel,     setNewLabel]     = useState('')
  const [saved,        setSaved]        = useState(false)
  const [saveError,    setSaveError]    = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [promptReset,  setPromptReset]  = useState(false)

  // Carga inicial desde Supabase
  const loadConfig = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ai_bias')
      .select('model, system_prompt, fields')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!error && data) {
      setModel(data.model)
      setSystemPrompt(data.system_prompt)
      if (Array.isArray(data.fields) && data.fields.length > 0) {
        setFields(data.fields as ExtractionField[])
      }
    }
    setLoading(false)
  }, [user.id])

  useEffect(() => { loadConfig() }, [loadConfig])

  const activeCount = fields.filter((f) => f.enabled).length
  const withContext = fields.filter((f) => f.context.trim()).length

  const previewJson = Object.fromEntries(
    fields.filter((f) => f.enabled).map((f) => [f.key, null])
  )

  function toggleExpand(id: string) {
    setExpandedId((prev) => prev === id ? null : id)
  }

  function updateField(id: string, patch: Partial<ExtractionField>) {
    setFields((p) => p.map((f) => f.id === id ? { ...f, ...patch } : f))
  }

  function removeField(id: string) {
    setFields((p) => p.filter((f) => f.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  function addField() {
    const k = newKey.trim().replace(/\s+/g, '_')
    const l = newLabel.trim()
    if (!k || !l) return
    const id = String(Date.now())
    setFields((p) => [...p, { id, key: k, label: l, context: '', enabled: true }])
    setNewKey(''); setNewLabel('')
    setExpandedId(id)
  }

  function resetPrompt() {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT)
    setPromptReset(true)
    setTimeout(() => setPromptReset(false), 2000)
  }

  async function handleSave() {
    setSaveError(null)
    const payload = { user_id: user.id, model, system_prompt: systemPrompt, fields }
    const { error } = await supabase
      .from('ai_bias')
      .upsert(payload, { onConflict: 'user_id' })

    if (error) {
      setSaveError('No se pudo guardar la configuración. Inténtalo de nuevo.')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 rounded-full border-2 border-[#2B58C4]/20 border-t-[#2B58C4] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* ── Modelo ── */}
      <div>
        <FieldLabel htmlFor="ai-model">Modelo de IA</FieldLabel>
        <SelectInput id="ai-model" value={model} onChange={setModel} options={[
          { value: 'claude-opus-4-6',          label: 'Claude Opus 4.6 — máxima precisión' },
          { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6 — equilibrado (recomendado)' },
          { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — más rápido, menor coste' },
        ]} />
        <p className="text-[10px] text-gray-400 mt-1.5">
          Sonnet ofrece el mejor equilibrio entre precisión jurídica y velocidad de respuesta.
        </p>
      </div>

      {/* ── System prompt ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <FieldLabel htmlFor="system-prompt">System prompt</FieldLabel>
          <button onClick={resetPrompt}
            className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors focus:outline-none ${
              promptReset ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}>
            <RotateCcw className="w-3 h-3" />
            {promptReset ? 'Restaurado' : 'Restaurar'}
          </button>
        </div>
        <textarea id="system-prompt" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
          rows={8} spellCheck={false}
          className="w-full text-xs font-mono px-3 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/30 focus:border-[#2B58C4] transition" />
        <p className="text-[10px] text-gray-400 mt-1.5 flex items-start gap-1">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
          Instrucciones globales que se envían al modelo antes de los documentos.
        </p>
      </div>

      {/* ── Campos de extracción ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold text-gray-700">Campos de extracción JSON</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Define qué conceptos debe identificar la IA. Despliega cada campo para añadir contexto.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#2B58C4]">
              {activeCount} activos
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
              {withContext} con contexto
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {fields.map((f) => (
            <FieldRow
              key={f.id}
              field={f}
              expanded={expandedId === f.id}
              onToggleExpand={() => toggleExpand(f.id)}
              onToggleEnabled={() => updateField(f.id, { enabled: !f.enabled })}
              onChangeContext={(v) => updateField(f.id, { context: v })}
              onRemove={() => removeField(f.id)}
            />
          ))}
        </div>

        {/* Añadir campo */}
        <div className="mt-3 flex gap-2">
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addField()}
            placeholder="clave_json"
            className="w-36 flex-shrink-0 text-xs font-mono px-3 py-2 rounded-xl border border-dashed border-gray-300 bg-white placeholder-gray-300 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/30 focus:border-[#2B58C4] transition" />
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addField()}
            placeholder="Descripción del campo"
            className="flex-1 text-xs px-3 py-2 rounded-xl border border-dashed border-gray-300 bg-white placeholder-gray-300 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/30 focus:border-[#2B58C4] transition" />
          <button onClick={addField} disabled={!newKey.trim() || !newLabel.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#2B58C4] hover:bg-[#2348A8] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition focus:outline-none focus:ring-2 focus:ring-[#2B58C4] focus:ring-offset-1">
            <Plus className="w-3.5 h-3.5" />Añadir
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
          <Info className="w-3 h-3" />
          Al añadir un campo, se abrirá automáticamente para que puedas escribir el contexto.
        </p>
      </div>

      {/* ── Vista previa JSON ── */}
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-2">Vista previa del JSON extraído</p>
        <pre className="text-[11px] font-mono bg-gray-900 text-emerald-300 rounded-xl px-4 py-4 overflow-x-auto leading-relaxed max-h-60 overflow-y-auto">
          {JSON.stringify(previewJson, null, 2)}
        </pre>
        <p className="text-[10px] text-gray-400 mt-1.5">
          Estructura exacta devuelta por la IA. Los valores <code className="font-mono bg-gray-100 px-1 rounded">null</code> se rellenan con los datos del documento.
        </p>
      </div>

      <div className="pt-1 flex items-center justify-end gap-3">
        {saveError && (
          <p className="text-xs text-red-500 flex-1">{saveError}</p>
        )}
        <SaveButton onClick={handleSave} saved={saved} />
      </div>
    </div>
  )
}

// ── Selector de campo para añadir a un grupo ──────────────────────────────
function FieldAdder({
  available,
  onAdd,
  color,
}: {
  available: PdfExtractionField[]
  onAdd: (key: string) => void
  color: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const filtered = available.filter(
    (f) => f.label.toLowerCase().includes(search.toLowerCase()) || f.key.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((v) => !v); setSearch('') }}
        disabled={available.length === 0}
        className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-dashed transition focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ borderColor: color, color }}
      >
        <Plus className="w-3 h-3" />
        {available.length === 0 ? 'Sin campos disponibles' : 'Añadir campo'}
      </button>
      {open && available.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-20 w-64 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar campo…"
              className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/30 focus:border-[#2B58C4] transition"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-gray-400 italic">Sin resultados.</p>
            ) : filtered.map((f) => (
              <button
                key={f.key}
                onClick={() => { onAdd(f.key); setOpen(false); setSearch('') }}
                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 focus:outline-none"
              >
                <p className="text-xs font-semibold text-gray-800 truncate">{f.label}</p>
                <code className="text-[9px] text-gray-400 font-mono">{f.key}</code>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sección Informe PDF ────────────────────────────────────────────────────
type InformeTab = 'encabezado' | 'secciones' | 'estilo' | 'campos' | 'preview'

function InformeSection({ user }: { user: User }) {
  const [tab,            setTab]            = useState<InformeTab>('encabezado')
  const [loading,        setLoading]        = useState(true)
  const [saved,          setSaved]          = useState(false)
  const [saveError,      setSaveError]      = useState<string | null>(null)

  // Encabezado
  const [firmName,       setFirmName]       = useState('')
  const [firmTagline,    setFirmTagline]    = useState('')
  const [firmAddress,    setFirmAddress]    = useState('')
  const [firmPhone,      setFirmPhone]      = useState('')
  const [firmEmail,      setFirmEmail]      = useState('')
  const [firmWeb,        setFirmWeb]        = useState('')
  const [footerText,     setFooterText]     = useState('')

  // Estilo
  const [primaryColor,   setPrimaryColor]   = useState('#2B58C4')
  const [secondaryColor, setSecondaryColor] = useState('#F8FAFC')
  const [fontSize,       setFontSize]       = useState('normal')

  // Secciones
  const [sections,       setSections]       = useState<ReportSection[]>(DEFAULT_REPORT_SECTIONS)

  // Campos: mapeo de campos IA a secciones del informe
  const [fieldSections,  setFieldSections]  = useState<FieldSections>({ ...DEFAULT_FIELD_SECTIONS })
  const [aiFields,       setAiFields]       = useState<PdfExtractionField[]>([])

  const loadConfig = useCallback(async () => {
    setLoading(true)
    const [{ data }, { data: aiData }] = await Promise.all([
      supabase.from('report_config').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('ai_bias').select('fields').eq('user_id', user.id).maybeSingle(),
    ])

    if (data) {
      setFirmName(data.firm_name ?? '')
      setFirmTagline(data.firm_tagline ?? '')
      setFirmAddress(data.firm_address ?? '')
      setFirmPhone(data.firm_phone ?? '')
      setFirmEmail(data.firm_email ?? '')
      setFirmWeb(data.firm_web ?? '')
      setFooterText(data.footer_text ?? '')
      setPrimaryColor(data.primary_color ?? '#2B58C4')
      setSecondaryColor(data.secondary_color ?? '#F8FAFC')
      setFontSize(data.font_size ?? 'normal')
      if (Array.isArray(data.sections) && data.sections.length > 0) {
        setSections(data.sections as ReportSection[])
      }
      if (data.field_sections) {
        setFieldSections({ ...DEFAULT_FIELD_SECTIONS, ...(data.field_sections as FieldSections) })
      }
    }
    if (Array.isArray(aiData?.fields) && aiData.fields.length > 0) {
      setAiFields(aiData.fields as PdfExtractionField[])
    } else {
      setAiFields(DEFAULT_FIELDS as PdfExtractionField[])
    }
    setLoading(false)
  }, [user.id])

  useEffect(() => { loadConfig() }, [loadConfig])

  async function handleSave() {
    setSaveError(null)
    const payload = {
      user_id: user.id,
      firm_name: firmName, firm_tagline: firmTagline,
      firm_address: firmAddress, firm_phone: firmPhone,
      firm_email: firmEmail, firm_web: firmWeb,
      footer_text: footerText,
      primary_color: primaryColor, secondary_color: secondaryColor,
      font_size: fontSize, sections,
      field_sections: fieldSections,
    }
    const { error } = await supabase
      .from('report_config')
      .upsert(payload, { onConflict: 'user_id' })

    if (error) { setSaveError('No se pudo guardar. Inténtalo de nuevo.'); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function moveSection(idx: number, dir: -1 | 1) {
    setSections((prev) => {
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  function toggleSection(id: string) {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  function updateSectionTitle(id: string, title: string) {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, title } : s))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 rounded-full border-2 border-[#2B58C4]/20 border-t-[#2B58C4] animate-spin" />
      </div>
    )
  }

  // Campos no asignables (listas dedicadas) + helper
  const allAssigned = new Set([
    ...fieldSections.procedimiento,
    ...fieldSections.partes,
    ...fieldSections.calendario,
  ])
  // Campos disponibles (activos, no especiales, no ya asignados en otra sección)
  const assignableFields = aiFields.filter(
    (f) => f.enabled && !SPECIAL_LIST_KEYS.has(f.key)
  )
  // Campos sin asignar → aparecen automáticamente en "Datos completos"
  const unassignedFields = assignableFields.filter((f) => !allAssigned.has(f.key))

  function moveFieldInGroup(group: keyof FieldSections, idx: number, dir: -1 | 1) {
    setFieldSections((prev) => {
      const arr = [...prev[group]]
      const swap = idx + dir
      if (swap < 0 || swap >= arr.length) return prev
      ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
      return { ...prev, [group]: arr }
    })
  }

  function removeFieldFromGroup(group: keyof FieldSections, key: string) {
    setFieldSections((prev) => ({ ...prev, [group]: prev[group].filter((k) => k !== key) }))
  }

  function addFieldToGroup(group: keyof FieldSections, key: string) {
    // Quita de otro grupo si ya estaba
    setFieldSections((prev) => {
      const cleaned: FieldSections = {
        procedimiento: prev.procedimiento.filter((k) => k !== key),
        partes:        prev.partes.filter((k) => k !== key),
        calendario:    prev.calendario.filter((k) => k !== key),
      }
      return { ...cleaned, [group]: [...cleaned[group], key] }
    })
  }

  // Tabs internas
  const TABS: { id: InformeTab; label: string; Icon: React.ElementType }[] = [
    { id: 'encabezado', label: 'Encabezado',  Icon: Building2 },
    { id: 'secciones',  label: 'Secciones',   Icon: LayoutList },
    { id: 'estilo',     label: 'Estilo',      Icon: Palette },
    { id: 'campos',     label: 'Campos',      Icon: Layers },
    { id: 'preview',    label: 'Preview',     Icon: Monitor },
  ]

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all focus:outline-none ${
              tab === id
                ? 'bg-white text-[#2B58C4] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Encabezado ── */}
      {tab === 'encabezado' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <FieldLabel htmlFor="rpt-firm">Nombre del despacho</FieldLabel>
              <TextInput id="rpt-firm" value={firmName} onChange={setFirmName} placeholder="RUA Abogados S.L." />
            </div>
            <div className="col-span-2">
              <FieldLabel htmlFor="rpt-tag">Tagline / especialidad</FieldLabel>
              <TextInput id="rpt-tag" value={firmTagline} onChange={setFirmTagline} placeholder="Especialistas en derecho de consumo" />
            </div>
            <div className="col-span-2">
              <FieldLabel htmlFor="rpt-addr">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Dirección</span>
              </FieldLabel>
              <TextInput id="rpt-addr" value={firmAddress} onChange={setFirmAddress} placeholder="Calle Mayor 1, 28001 Madrid" />
            </div>
            <div>
              <FieldLabel htmlFor="rpt-phone">
                <span className="flex items-center gap-1"><Phone className="w-3 h-3" />Teléfono</span>
              </FieldLabel>
              <TextInput id="rpt-phone" value={firmPhone} onChange={setFirmPhone} placeholder="+34 91 000 00 00" />
            </div>
            <div>
              <FieldLabel htmlFor="rpt-email">
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" />Email</span>
              </FieldLabel>
              <TextInput id="rpt-email" value={firmEmail} onChange={setFirmEmail} placeholder="info@ruaabogados.es" />
            </div>
            <div className="col-span-2">
              <FieldLabel htmlFor="rpt-web">
                <span className="flex items-center gap-1"><Globe className="w-3 h-3" />Web</span>
              </FieldLabel>
              <TextInput id="rpt-web" value={firmWeb} onChange={setFirmWeb} placeholder="https://ruaabogados.es" />
            </div>
            <div className="col-span-2">
              <FieldLabel htmlFor="rpt-footer">Texto del pie de página</FieldLabel>
              <textarea id="rpt-footer" value={footerText} onChange={(e) => setFooterText(e.target.value)}
                rows={2} placeholder="Ej. Documento generado automáticamente por ONLY8H · Confidencial"
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 bg-white placeholder-gray-300 text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/30 focus:border-[#2B58C4] transition" />
            </div>
          </div>
        </div>
      )}

      {/* ── Secciones ── */}
      {tab === 'secciones' && (
        <div className="space-y-3">
          <p className="text-[10px] text-gray-400 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Activa, desactiva y reordena las secciones del informe. Edita el título de cada una.
          </p>
          <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {sections.map((sec, idx) => (
              <div key={sec.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${sec.enabled ? 'bg-white' : 'bg-gray-50/60'}`}>
                {/* Orden */}
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button onClick={() => moveSection(idx, -1)} disabled={idx === 0}
                    className="p-0.5 rounded text-gray-300 hover:text-gray-500 disabled:opacity-20 focus:outline-none">
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button onClick={() => moveSection(idx, 1)} disabled={idx === sections.length - 1}
                    className="p-0.5 rounded text-gray-300 hover:text-gray-500 disabled:opacity-20 focus:outline-none">
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                {/* Toggle */}
                <button role="switch" aria-checked={sec.enabled} onClick={() => toggleSection(sec.id)}
                  className={`relative flex-shrink-0 w-8 h-4 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/30 ${sec.enabled ? 'bg-[#2B58C4]' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${sec.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>

                {/* Número de orden */}
                <span className="text-[10px] font-bold text-gray-300 w-4 flex-shrink-0 text-center">{idx + 1}</span>

                {/* Título editable */}
                <div className="flex-1 min-w-0">
                  <input value={sec.title}
                    onChange={(e) => updateSectionTitle(sec.id, e.target.value)}
                    className={`w-full text-xs font-semibold bg-transparent border-b border-transparent hover:border-gray-200 focus:border-[#2B58C4] focus:outline-none py-0.5 transition-colors ${sec.enabled ? 'text-gray-800' : 'text-gray-400'}`} />
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">{sec.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Estilo ── */}
      {tab === 'estilo' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="color-primary">Color principal</FieldLabel>
              <div className="flex items-center gap-2">
                <input id="color-primary" type="color" value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer p-0.5 bg-white" />
                <span className="text-xs font-mono text-gray-500">{primaryColor.toUpperCase()}</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">Cabeceras, líneas divisorias y acentos del informe.</p>
            </div>
            <div>
              <FieldLabel htmlFor="color-secondary">Color de fondo</FieldLabel>
              <div className="flex items-center gap-2">
                <input id="color-secondary" type="color" value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer p-0.5 bg-white" />
                <span className="text-xs font-mono text-gray-500">{secondaryColor.toUpperCase()}</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">Fondo de las cabeceras de tabla y bloques destacados.</p>
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="font-size">Tamaño de texto</FieldLabel>
            <SelectInput id="font-size" value={fontSize} onChange={setFontSize} options={[
              { value: 'small',  label: 'Pequeño (9 pt)' },
              { value: 'normal', label: 'Normal (10 pt) — recomendado' },
              { value: 'large',  label: 'Grande (11 pt)' },
            ]} />
          </div>

          {/* Muestra de colores */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Muestra de colores</p>
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <div className="px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: primaryColor }}>
                <span className="text-sm font-bold text-white">
                  {firmName || 'Nombre del despacho'}
                </span>
                <span className="text-[10px] text-white/70">INFORME JURÍDICO</span>
              </div>
              <div className="px-4 py-2.5" style={{ backgroundColor: secondaryColor }}>
                <div className="flex gap-4">
                  {['NIG', 'Juzgado', 'Cuantía'].map((k) => (
                    <div key={k}>
                      <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: primaryColor }}>{k}</p>
                      <p className="text-xs text-gray-500">—</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-4 py-2 border-t border-gray-100">
                <p className="text-[9px] text-gray-400 text-center">
                  {footerText || 'Pie de página del informe'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Vista previa ── */}
      {tab === 'preview' && (
        <div className="space-y-3">
          <p className="text-[10px] text-gray-400 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Simulación de la primera página del informe PDF con tu configuración actual.
          </p>
          {/* Mock de página A4 */}
          <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            style={{ fontFamily: 'Georgia, serif' }}>
            {/* Cabecera del PDF */}
            <div className="px-8 py-5 flex items-start justify-between"
              style={{ backgroundColor: primaryColor }}>
              <div>
                <p className="text-base font-bold text-white leading-tight">
                  {firmName || 'Nombre del despacho'}
                </p>
                {firmTagline && (
                  <p className="text-[10px] text-white/70 mt-0.5">{firmTagline}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold tracking-widest text-white/60 uppercase">Informe Jurídico</p>
                <p className="text-[10px] text-white/80 mt-1">
                  {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Datos de contacto */}
            <div className="px-8 py-2 flex flex-wrap gap-x-5 gap-y-0.5"
              style={{ backgroundColor: secondaryColor }}>
              {firmAddress && <span className="text-[9px] text-gray-500 flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{firmAddress}</span>}
              {firmPhone   && <span className="text-[9px] text-gray-500 flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{firmPhone}</span>}
              {firmEmail   && <span className="text-[9px] text-gray-500 flex items-center gap-1"><Mail className="w-2.5 h-2.5" />{firmEmail}</span>}
              {firmWeb     && <span className="text-[9px] text-gray-500 flex items-center gap-1"><Globe className="w-2.5 h-2.5" />{firmWeb}</span>}
            </div>

            {/* Separador de color */}
            <div className="h-0.5 w-full" style={{ backgroundColor: primaryColor }} />

            {/* Título del expediente */}
            <div className="px-8 py-5">
              <p className="text-[9px] font-bold uppercase tracking-widest mb-3"
                style={{ color: primaryColor }}>Datos del procedimiento</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'NIG',         value: '28079470120240012345' },
                  { label: 'Juzgado',     value: 'JPI n.º 3 de Madrid' },
                  { label: 'Autos',       value: '123/2024' },
                  { label: 'Demandante',  value: 'Juan García López' },
                  { label: 'Demandado',   value: 'Entidad Financiera S.A.' },
                  { label: 'Cuantía',     value: '4.823,50 €' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg px-3 py-2"
                    style={{ backgroundColor: secondaryColor }}>
                    <p className="text-[8px] font-bold uppercase tracking-wide"
                      style={{ color: primaryColor }}>{label}</p>
                    <p className="text-[10px] text-gray-700 mt-0.5 font-medium">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Índice de secciones */}
            <div className="px-8 pb-5">
              <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
                style={{ color: primaryColor }}>Contenido del informe</p>
              <div className="space-y-1">
                {sections.filter((s) => s.enabled).map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="text-[9px] font-bold w-4" style={{ color: primaryColor }}>{i + 1}</span>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="h-px flex-1 border-b border-dotted border-gray-200" />
                    </div>
                    <span className="text-[9px] text-gray-600">{s.title}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pie */}
            <div className="px-8 py-2 border-t border-gray-100">
              <p className="text-[8px] text-gray-400 text-center">
                {footerText || 'Documento generado automáticamente · Confidencial'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Campos ── */}
      {tab === 'campos' && (
        <div className="space-y-6">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-[#EEF2FF] border border-[#C7D7F5]">
            <Info className="w-3.5 h-3.5 text-[#2B58C4] mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-[#2B58C4] leading-relaxed">
              Asigna los campos extraídos por la IA a cada tabla del informe. Los campos no asignados aparecen automáticamente en <strong>Datos completos</strong>. Los campos de lista (Acciones, Excepciones, Hechos) siempre van a sus propias secciones.
            </p>
          </div>

          {([
            {
              group: 'procedimiento' as const,
              Icon: Gavel,
              title: 'Datos del procedimiento',
              desc: 'PDF: tabla de portada (parte superior) · Word: sección 1',
              color: '#2B58C4',
              bg: '#EEF2FF',
            },
            {
              group: 'partes' as const,
              Icon: Users,
              title: 'Partes intervinientes',
              desc: 'PDF: tabla de portada (parte inferior) · Word: sección 2',
              color: '#7C3AED',
              bg: '#F5F3FF',
            },
            {
              group: 'calendario' as const,
              Icon: Calendar,
              title: 'Calendario procesal',
              desc: 'PDF: sección de calendario · Word: sección 3',
              color: '#D97706',
              bg: '#FFFBEB',
            },
          ] as const).map(({ group, Icon, title, desc, color, bg }) => {
            const keys = fieldSections[group]
            // Campos disponibles para añadir a este grupo (no ya en él, no especiales, activos)
            const available = assignableFields.filter((f) => !keys.includes(f.key) && !allAssigned.has(f.key))
            // Añade también los de otros grupos (para poder mover)
            const movable = assignableFields.filter((f) => !keys.includes(f.key))

            return (
              <div key={group} className="rounded-xl border border-gray-200 overflow-hidden">
                {/* Cabecera del grupo */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100" style={{ backgroundColor: bg }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: color }}>
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold" style={{ color }}>{title}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{desc}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: color, color: '#fff' }}>
                    {keys.length} campo{keys.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Lista de campos asignados */}
                <div className="divide-y divide-gray-50">
                  {keys.length === 0 && (
                    <p className="px-4 py-3 text-[11px] text-gray-400 italic">Sin campos asignados — arrastra o añade uno.</p>
                  )}
                  {keys.map((key, idx) => {
                    const f = aiFields.find((af) => af.key === key)
                    const label = f?.label ?? key
                    return (
                      <div key={key} className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50/60 transition-colors">
                        <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />

                        {/* Reordenar */}
                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                          <button onClick={() => moveFieldInGroup(group, idx, -1)} disabled={idx === 0}
                            className="p-0.5 rounded text-gray-300 hover:text-gray-500 disabled:opacity-20 focus:outline-none">
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button onClick={() => moveFieldInGroup(group, idx, 1)} disabled={idx === keys.length - 1}
                            className="p-0.5 rounded text-gray-300 hover:text-gray-500 disabled:opacity-20 focus:outline-none">
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Número + clave */}
                        <span className="text-[9px] font-bold text-gray-300 w-4 text-center flex-shrink-0">{idx + 1}</span>
                        <code className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: bg, color }}>{key}</code>

                        {/* Etiqueta */}
                        <span className="flex-1 text-xs text-gray-700 truncate">{label}</span>

                        {/* Eliminar */}
                        <button onClick={() => removeFieldFromGroup(group, key)}
                          className="flex-shrink-0 p-1 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors focus:outline-none">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Añadir campo */}
                <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/40">
                  <FieldAdder
                    available={movable.length > 0 ? movable : available}
                    onAdd={(key) => addFieldToGroup(group, key)}
                    color={color}
                  />
                </div>
              </div>
            )
          })}

          {/* Datos completos (auto) */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="w-7 h-7 rounded-lg bg-gray-400 flex items-center justify-center">
                <LayoutList className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-600">Datos completos</p>
                <p className="text-[10px] text-gray-400">PDF: sección completa con todos los campos activos · Word: "Otros datos"</p>
              </div>
            </div>
            <div className="px-4 py-3">
              {unassignedFields.length === 0 ? (
                <p className="text-[11px] text-gray-400 italic">Todos los campos activos están asignados a una sección.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {unassignedFields.map((f) => (
                    <span key={f.key} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-[10px] font-medium">
                      <code className="font-mono text-gray-400 text-[9px]">{f.key}</code>
                      {f.label}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Estos campos no pertenecen a ninguna tabla configurada y se volcán en la sección "Datos completos".
              </p>
            </div>
          </div>

          {/* Secciones fijas */}
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-3 space-y-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Secciones fijas (no configurables)</p>
            {[
              { label: 'Acciones ejercitadas', key: 'acciones_ejercitadas', color: '#059669' },
              { label: 'Excepciones procesales', key: 'excepciones_procesales', color: '#DC2626' },
              { label: 'Hechos controvertidos', key: 'hechos_controvertidos', color: '#0891B2' },
            ].map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }} />
                <span className="text-xs text-gray-500">{f.label}</span>
                <code className="text-[9px] font-mono text-gray-300 ml-auto">{f.key}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guardar */}
      <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100">
        {saveError && <p className="text-xs text-red-500 flex-1">{saveError}</p>}
        <SaveButton onClick={handleSave} saved={saved} />
      </div>
    </div>
  )
}

// ── Sección Cuenta ─────────────────────────────────────────────────────────
function CuentaSection({ user }: { user: User }) {
  const [showPass,    setShowPass]    = useState(false)
  const [newPass,     setNewPass]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [saved,       setSaved]       = useState(false)

  function handleSave() { setSaved(true); setTimeout(() => setSaved(false), 2500) }

  return (
    <div className="space-y-5">
      <div>
        <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
        <TextInput id="email" value={user.email ?? ''} onChange={() => {}} disabled />
        <p className="text-[10px] text-gray-400 mt-1.5">El email no se puede modificar desde aquí.</p>
      </div>
      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-600 mb-4">Cambiar contraseña</p>
        <div className="space-y-3">
          <div>
            <FieldLabel htmlFor="new-pass">Nueva contraseña</FieldLabel>
            <div className="relative">
              <TextInput id="new-pass" value={newPass} onChange={setNewPass}
                type={showPass ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" />
              <button type="button" onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showPass ? 'Ocultar' : 'Mostrar'}>
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="confirm-pass">Confirmar contraseña</FieldLabel>
            <TextInput id="confirm-pass" value={confirmPass} onChange={setConfirmPass}
              type={showPass ? 'text' : 'password'} placeholder="Repite la nueva contraseña" />
            {confirmPass && newPass !== confirmPass && (
              <p className="text-[10px] text-red-500 mt-1.5">Las contraseñas no coinciden.</p>
            )}
          </div>
        </div>
      </div>
      <div className="pt-2 flex justify-end">
        <SaveButton onClick={handleSave} saved={saved} />
      </div>
    </div>
  )
}

// ── Sección Firma ──────────────────────────────────────────────────────────
function FirmaSection() {
  const [nombre,    setNombre]    = useState('')
  const [nif,       setNif]       = useState('')
  const [direccion, setDireccion] = useState('')
  const [ciudad,    setCiudad]    = useState('')
  const [telefono,  setTelefono]  = useState('')
  const [web,       setWeb]       = useState('')
  const [saved,     setSaved]     = useState(false)

  function handleSave() { setSaved(true); setTimeout(() => setSaved(false), 2500) }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <FieldLabel htmlFor="nombre-firma">Nombre del despacho</FieldLabel>
          <TextInput id="nombre-firma" value={nombre} onChange={setNombre} placeholder="Ej. RUA Abogados S.L." />
        </div>
        <div>
          <FieldLabel htmlFor="nif">NIF / CIF</FieldLabel>
          <TextInput id="nif" value={nif} onChange={setNif} placeholder="B12345678" />
        </div>
        <div>
          <FieldLabel htmlFor="telefono">Teléfono</FieldLabel>
          <TextInput id="telefono" value={telefono} onChange={setTelefono} placeholder="+34 600 000 000" />
        </div>
        <div className="col-span-2">
          <FieldLabel htmlFor="direccion">Dirección</FieldLabel>
          <TextInput id="direccion" value={direccion} onChange={setDireccion} placeholder="Calle, número, piso" />
        </div>
        <div>
          <FieldLabel htmlFor="ciudad">Ciudad</FieldLabel>
          <TextInput id="ciudad" value={ciudad} onChange={setCiudad} placeholder="Madrid" />
        </div>
        <div>
          <FieldLabel htmlFor="web">Sitio web</FieldLabel>
          <TextInput id="web" value={web} onChange={setWeb} placeholder="https://ruaabogados.es" />
        </div>
      </div>
      <div className="pt-2 flex justify-end">
        <SaveButton onClick={handleSave} saved={saved} />
      </div>
    </div>
  )
}

// ── Sección Preferencias ───────────────────────────────────────────────────
function AnalisisSection() {
  const [idioma,  setIdioma]  = useState('es')
  const [detalle, setDetalle] = useState('completo')
  const [formato, setFormato] = useState('pdf')
  const [saved,   setSaved]   = useState(false)

  function handleSave() { setSaved(true); setTimeout(() => setSaved(false), 2500) }

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel htmlFor="idioma">Idioma del informe</FieldLabel>
        <SelectInput id="idioma" value={idioma} onChange={setIdioma} options={[
          { value: 'es', label: 'Español' },
          { value: 'ca', label: 'Català' },
          { value: 'eu', label: 'Euskera' },
          { value: 'gl', label: 'Galego' },
          { value: 'en', label: 'English' },
        ]} />
      </div>
      <div>
        <FieldLabel htmlFor="detalle">Nivel de detalle</FieldLabel>
        <SelectInput id="detalle" value={detalle} onChange={setDetalle} options={[
          { value: 'resumen',  label: 'Resumen ejecutivo' },
          { value: 'estandar', label: 'Estándar' },
          { value: 'completo', label: 'Completo (con cláusulas y riesgos)' },
        ]} />
        <p className="text-[10px] text-gray-400 mt-1.5">El nivel completo incluye análisis de cláusulas clave e identificación de riesgos.</p>
      </div>
      <div>
        <FieldLabel htmlFor="formato">Formato de exportación</FieldLabel>
        <SelectInput id="formato" value={formato} onChange={setFormato} options={[
          { value: 'pdf',  label: 'PDF' },
          { value: 'docx', label: 'Word (DOCX)' },
        ]} />
      </div>
      <div className="pt-2 flex justify-end">
        <SaveButton onClick={handleSave} saved={saved} />
      </div>
    </div>
  )
}

// ── Sección Notificaciones ─────────────────────────────────────────────────
function NotificacionesSection() {
  const [emailAlCompletar, setEmailAlCompletar] = useState(true)
  const [resumenSemanal,   setResumenSemanal]   = useState(false)
  const [alertasRiesgo,    setAlertasRiesgo]    = useState(true)
  const [saved,            setSaved]            = useState(false)

  function handleSave() { setSaved(true); setTimeout(() => setSaved(false), 2500) }

  return (
    <div className="space-y-1">
      <Toggle checked={emailAlCompletar} onChange={setEmailAlCompletar}
        label="Email al completar análisis" description="Recibe un correo cuando el informe esté listo" />
      <Toggle checked={alertasRiesgo} onChange={setAlertasRiesgo}
        label="Alertas de riesgo alto" description="Notificación cuando el análisis detecta riesgos críticos" />
      <Toggle checked={resumenSemanal} onChange={setResumenSemanal}
        label="Resumen semanal" description="Informe con los análisis realizados durante la semana" />
      <div className="pt-4 flex justify-end">
        <SaveButton onClick={handleSave} saved={saved} />
      </div>
    </div>
  )
}

// ── Sección Excepciones procesales ─────────────────────────────────────────
interface ExcepcionRow {
  id: string          // uuid de BD o temporal mientras se crea
  nombre: string
  texto_asociado: string
  isNew?: boolean     // fila recién añadida, aún no guardada en BD
}

function ExcepcionesSection({ user }: { user: User }) {
  const [rows,      setRows]      = useState<ExcepcionRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBuf,   setEditBuf]   = useState<{ nombre: string; texto_asociado: string }>({ nombre: '', texto_asociado: '' })
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  // Carga
  useEffect(() => {
    supabase
      .from('excepciones_procesales')
      .select('id, nombre, texto_asociado')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .then(({ data, error: e }) => {
        setLoading(false)
        if (e) { setError('No se pudieron cargar las excepciones.'); return }
        setRows((data ?? []) as ExcepcionRow[])
      })
  }, [user.id])

  function startEdit(row: ExcepcionRow) {
    setEditingId(row.id)
    setEditBuf({ nombre: row.nombre, texto_asociado: row.texto_asociado })
  }

  function cancelEdit() {
    // Si era nueva y se cancela, eliminar de la lista local
    setRows((prev) => prev.filter((r) => !(r.isNew && r.id === editingId)))
    setEditingId(null)
  }

  async function saveEdit(row: ExcepcionRow) {
    setError(null)
    const nombre         = editBuf.nombre.trim()
    const texto_asociado = editBuf.texto_asociado.trim()
    if (!nombre) { setError('El nombre de la excepción es obligatorio.'); return }

    setSaving(true)

    if (row.isNew) {
      // INSERT
      const { data, error: e } = await supabase
        .from('excepciones_procesales')
        .insert({ user_id: user.id, nombre, texto_asociado })
        .select('id, nombre, texto_asociado')
        .single()

      setSaving(false)
      if (e) { setError('No se pudo guardar la excepción.'); return }
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...data } as ExcepcionRow : r))
    } else {
      // UPDATE
      const { error: e } = await supabase
        .from('excepciones_procesales')
        .update({ nombre, texto_asociado })
        .eq('id', row.id)
        .eq('user_id', user.id)

      setSaving(false)
      if (e) { setError('No se pudo actualizar la excepción.'); return }
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, nombre, texto_asociado } : r))
    }

    setEditingId(null)
  }

  async function deleteRow(id: string) {
    setError(null)
    const { error: e } = await supabase
      .from('excepciones_procesales')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (e) { setError('No se pudo eliminar la excepción.'); return }
    setRows((prev) => prev.filter((r) => r.id !== id))
    if (editingId === id) setEditingId(null)
  }

  function addRow() {
    const tempId = `new-${Date.now()}`
    const newRow: ExcepcionRow = { id: tempId, nombre: '', texto_asociado: '', isNew: true }
    setRows((prev) => [...prev, newRow])
    setEditingId(tempId)
    setEditBuf({ nombre: '', texto_asociado: '' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 rounded-full border-2 border-[#2B58C4]/20 border-t-[#2B58C4] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Info */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-100">
        <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-red-700 mb-0.5">¿Cómo funciona?</p>
          <p className="text-[11px] text-red-600 leading-relaxed">
            Cuando la IA detecte una excepción procesal en el expediente cuyo nombre coincida con el de esta tabla,
            el texto asociado se incluirá automáticamente en el informe PDF y Word.
          </p>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        {/* Cabecera */}
        <div className="grid grid-cols-[1fr_2fr_auto] gap-0 bg-gray-50 border-b border-gray-200">
          <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Nombre excepción</div>
          <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-l border-gray-200">Texto asociado en el informe</div>
          <div className="px-3 py-2.5 w-20" />
        </div>

        {/* Filas */}
        {rows.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-gray-400">
            No hay excepciones configuradas. Usa el botón «Añadir» para crear la primera.
          </div>
        )}

        {rows.map((row) => {
          const isEditing = editingId === row.id

          return (
            <div
              key={row.id}
              className={`grid grid-cols-[1fr_2fr_auto] gap-0 border-b border-gray-100 last:border-0 transition-colors ${isEditing ? 'bg-[#F5F8FF]' : 'bg-white hover:bg-gray-50/60'}`}
            >
              {/* Nombre */}
              <div className="px-4 py-3 flex items-start">
                {isEditing ? (
                  <input
                    autoFocus
                    value={editBuf.nombre}
                    onChange={(e) => setEditBuf((b) => ({ ...b, nombre: e.target.value }))}
                    placeholder="Ej. Prescripción"
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#C7D7F5] bg-white text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/30 focus:border-[#2B58C4] transition"
                  />
                ) : (
                  <span className="text-xs font-semibold text-gray-800 leading-snug">{row.nombre}</span>
                )}
              </div>

              {/* Texto asociado */}
              <div className="px-4 py-3 border-l border-gray-100 flex items-start">
                {isEditing ? (
                  <textarea
                    value={editBuf.texto_asociado}
                    onChange={(e) => setEditBuf((b) => ({ ...b, texto_asociado: e.target.value }))}
                    placeholder="Texto que aparecerá en el informe cuando se detecte esta excepción…"
                    rows={3}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#C7D7F5] bg-white text-gray-700 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/30 focus:border-[#2B58C4] transition leading-relaxed"
                  />
                ) : (
                  <span className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                    {row.texto_asociado || <span className="italic text-gray-300">Sin texto</span>}
                  </span>
                )}
              </div>

              {/* Acciones */}
              <div className="px-3 py-3 flex flex-col items-center justify-start gap-1.5 w-20">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => saveEdit(row)}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-[#2B58C4] hover:bg-[#2348A8] disabled:opacity-50 text-white text-[10px] font-semibold rounded-lg transition focus:outline-none"
                    >
                      <Check className="w-3 h-3" />
                      {saving ? '…' : 'OK'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-[10px] font-medium rounded-lg transition focus:outline-none"
                    >
                      <X className="w-3 h-3" />
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(row)}
                      className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[#2B58C4] hover:bg-[#EEF2FF] text-[10px] font-medium rounded-lg transition focus:outline-none"
                    >
                      <Pencil className="w-3 h-3" />
                      Editar
                    </button>
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 text-[10px] font-medium rounded-lg transition focus:outline-none"
                    >
                      <Trash2 className="w-3 h-3" />
                      Borrar
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <Info className="w-3.5 h-3.5" />
          {error}
        </p>
      )}

      {/* Añadir */}
      <button
        onClick={addRow}
        disabled={editingId !== null}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#2B58C4] hover:bg-[#2348A8] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition focus:outline-none focus:ring-2 focus:ring-[#2B58C4] focus:ring-offset-2"
      >
        <Plus className="w-3.5 h-3.5" />
        Añadir excepción
      </button>

      <p className="text-[10px] text-gray-400 flex items-start gap-1">
        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
        El nombre debe coincidir con el texto que devuelve la IA (búsqueda por inclusión, sin distinguir mayúsculas).
      </p>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function SettingsPage({ user }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<Section>('cuenta')
  const current = SECTIONS.find((s) => s.id === activeSection)!

  return (
    <div className="min-h-full flex flex-col items-center justify-start py-10 px-6">
      <div className="w-full max-w-3xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Configuración</h2>
          <p className="text-sm text-gray-400 mt-1.5">Gestiona tu cuenta, datos del despacho y preferencias.</p>
        </div>

        <div className="flex gap-6 items-start">
          {/* Menú lateral */}
          <nav className="w-52 flex-shrink-0 space-y-0.5" aria-label="Secciones de configuración">
            {SECTIONS.map(({ id, label, Icon }) => {
              const active = id === activeSection
              return (
                <button key={id} onClick={() => setActiveSection(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/40 ${
                    active ? 'bg-[#EEF2FF] text-[#2B58C4] font-semibold' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                  }`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {active && <ChevronRight className="w-3 h-3 opacity-50" />}
                </button>
              )
            })}
          </nav>

          {/* Panel */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] flex items-center justify-center">
                  <current.Icon className="w-4 h-4 text-[#2B58C4]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{current.label}</p>
                  <p className="text-xs text-gray-400">{current.description}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-6">
              {activeSection === 'cuenta'         && <CuentaSection user={user} />}
              {activeSection === 'firma'          && <FirmaSection />}
              {activeSection === 'ia'             && <IASection user={user} />}
              {activeSection === 'informe'        && <InformeSection user={user} />}
              {activeSection === 'excepciones'    && <ExcepcionesSection user={user} />}
              {activeSection === 'analisis'       && <AnalisisSection />}
              {activeSection === 'notificaciones' && <NotificacionesSection />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
