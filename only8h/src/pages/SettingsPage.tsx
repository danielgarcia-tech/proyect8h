import { useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
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
} from 'lucide-react'

interface SettingsPageProps { user: User }

// ── Secciones de navegación ────────────────────────────────────────────────
type Section = 'cuenta' | 'firma' | 'ia' | 'informe' | 'analisis' | 'notificaciones'
interface SectionItem { id: Section; label: string; description: string; Icon: React.ElementType }

const SECTIONS: SectionItem[] = [
  { id: 'cuenta',         label: 'Cuenta',                  description: 'Email, contraseña y sesión',              Icon: UserIcon },
  { id: 'firma',          label: 'Datos de la firma',        description: 'Nombre, NIF y datos del despacho',       Icon: Building2 },
  { id: 'ia',             label: 'Inteligencia Artificial',  description: 'Modelo, prompt y extracción JSON',       Icon: Sparkles },
  { id: 'informe',        label: 'Informe PDF',              description: 'Plantilla, secciones y estilo del PDF',  Icon: FileBarChart2 },
  { id: 'analisis',       label: 'Preferencias',             description: 'Idioma, detalle y formato del informe',  Icon: SlidersHorizontal },
  { id: 'notificaciones', label: 'Notificaciones',           description: 'Alertas y avisos por email',             Icon: Bell },
]

// ── Tipos para el informe PDF ──────────────────────────────────────────────
interface ReportSection {
  id: string
  title: string
  subtitle: string
  enabled: boolean
}

const DEFAULT_REPORT_SECTIONS: ReportSection[] = [
  { id: 'portada',      title: 'Portada',                  subtitle: 'NIG, partes, juzgado y fecha de vista',             enabled: true },
  { id: 'datos',        title: 'Datos del procedimiento',  subtitle: 'Tabla con todos los campos extraídos por la IA',    enabled: true },
  { id: 'acciones',     title: 'Acciones ejercitadas',     subtitle: 'Resumen en bullets del SOLICITO de la demanda',     enabled: true },
  { id: 'calendario',   title: 'Calendario procesal',      subtitle: 'Fecha de vista, tipo de acto y teléfono',           enabled: true },
  { id: 'excepciones',  title: 'Excepciones procesales',   subtitle: 'Excepciones alegadas por el demandado',             enabled: true },
  { id: 'hechos',       title: 'Hechos controvertidos',    subtitle: 'Hechos que el demandado niega o matiza',            enabled: true },
  { id: 'conclusiones', title: 'Conclusiones',             subtitle: 'Valoración jurídica y recomendaciones finales',     enabled: true },
]

// ── Campos de extracción ───────────────────────────────────────────────────
interface ExtractionField {
  id: string
  key: string
  label: string
  context: string   // explicación de contexto para la IA
  enabled: boolean
}

const DEFAULT_FIELDS: ExtractionField[] = [
  {
    id: '1', key: 'NIG', label: 'Número de Identificación General', enabled: true,
    context: 'Código único de 16 dígitos asignado por el sistema judicial español (LEXNET). Aparece en la cabecera de todos los escritos. Formato habitual: 28079470120240012345.',
  },
  {
    id: '2', key: 'procedimiento', label: 'Tipo de procedimiento', enabled: true,
    context: 'Indica la clase de proceso: juicio ordinario (cuantía >6.000 €), juicio verbal (≤6.000 €), monitorio, cambiario, etc. Extrae el término exacto que figure en el encabezado del escrito.',
  },
  {
    id: '3', key: 'juzgado', label: 'Juzgado competente', enabled: true,
    context: 'Nombre completo del órgano judicial incluyendo número y partido judicial. Ejemplo: "Juzgado de 1.ª Instancia n.º 3 de Madrid". Extrae del encabezado del emplazamiento o demanda.',
  },
  {
    id: '4', key: 'numero_autos', label: 'Número de autos', enabled: true,
    context: 'Número de expediente asignado por el juzgado. Suele aparecer como "Autos n.º XXX/YYYY" o "Procedimiento n.º XXX/YYYY" en el emplazamiento.',
  },
  {
    id: '5', key: 'dia_vista', label: 'Día de vista', enabled: true,
    context: 'Fecha y hora exactas del acto de juicio o audiencia previa según conste en el emplazamiento. Devuelve la fecha en formato ISO 8601 (YYYY-MM-DD) y la hora como cadena "HH:MM".',
  },
  {
    id: '6', key: 'telefono_incidencias', label: 'Teléfono de incidencias del juzgado', enabled: true,
    context: 'Número de teléfono facilitado por el juzgado para comunicar incidencias técnicas (habitual en vistas telemáticas). Suele figurar al pie del emplazamiento o citación.',
  },
  {
    id: '7', key: 'tipo_vista', label: 'Tipo de vista', enabled: true,
    context: 'Modalidad de celebración del acto: devuelve exactamente "PRESENCIAL" o "TELEMÁTICA" según indique el emplazamiento. Si no se especifica, devuelve "PRESENCIAL".',
  },
  {
    id: '8', key: 'demandante', label: 'Demandante', enabled: true,
    context: 'Nombre completo o razón social de la parte actora. En asuntos de consumo suele ser una persona física frente a una entidad financiera. Extrae de la demanda o del emplazamiento.',
  },
  {
    id: '9', key: 'demandado', label: 'Demandado', enabled: true,
    context: 'Nombre completo o razón social de la parte demandada. En asuntos de tarjetas revolving suele ser el banco o entidad financiera emisora.',
  },
  {
    id: '10', key: 'procurador', label: 'Procurador', enabled: true,
    context: 'Nombre del procurador que representa a la parte. Puede figurar en el encabezamiento de la demanda o en la diligencia de emplazamiento. Incluye "D." o "D.ª" si aparece.',
  },
  {
    id: '11', key: 'abogado', label: 'Abogado', enabled: true,
    context: 'Nombre del letrado que dirige la defensa. Aparece en el encabezamiento de la demanda o en el otrosí de designación. Incluye colegio y número de colegiado si constan.',
  },
  {
    id: '12', key: 'cuantia', label: 'Cuantía del procedimiento (€)', enabled: true,
    context: 'Importe reclamado. EXTRAE SIEMPRE DEL EMPLAZAMIENTO, no de la demanda. Devuelve un número sin símbolo de moneda ni separadores de miles. Ejemplo: 4823.50',
  },
  {
    id: '13', key: 'acciones_ejercitadas', label: 'Acciones ejercitadas', enabled: true,
    context: 'Resumen conciso en array de strings de los puntos del SOLICITO (petitum) de la demanda. Máximo 5 bullets. Cada bullet debe ser una frase breve en infinitivo. Ejemplo: ["Declarar la nulidad del contrato", "Condenar a la devolución de 4.823,50 €"].',
  },
  {
    id: '14', key: 'inicio_acto', label: 'Inicio del acto procesal', enabled: true,
    context: 'Indica si el procedimiento se inicia con AUDIENCIA_PREVIA (juicio ordinario) o directamente con JUICIO (juicio verbal). Extrae del emplazamiento. Devuelve exactamente "AUDIENCIA_PREVIA" o "JUICIO".',
  },
  {
    id: '15', key: 'excepciones_procesales', label: 'Excepciones procesales', enabled: true,
    context: 'Excepciones procesales o materiales alegadas por el demandado en la contestación (falta de legitimación, cosa juzgada, prescripción, caducidad, etc.). Devuelve array de strings o null si no se alegan excepciones.',
  },
  {
    id: '16', key: 'hechos_controvertidos', label: 'Hechos controvertidos', enabled: true,
    context: 'Hechos de la demanda que el demandado niega, matiza o contradice en la contestación. Extrae los puntos principales en array de strings concisos. Omite los hechos que el demandado admite.',
  },
  {
    id: '17', key: 'fecha_presentacion', label: 'Fecha de presentación de la demanda', enabled: false,
    context: 'Fecha en que se registró la demanda en el juzgado. Suele constar en el sello de registro o en la diligencia de admisión. Formato ISO 8601 (YYYY-MM-DD).',
  },
]

const DEFAULT_SYSTEM_PROMPT = `Eres un asistente jurídico especializado en análisis de documentos procesales españoles.

Analiza todos los documentos proporcionados y extrae los datos indicados en formato JSON estricto.
Devuelve ÚNICAMENTE el objeto JSON, sin texto adicional ni bloques de código.

Reglas generales:
- Si un campo no aparece en ningún documento, devuelve null.
- Normaliza los nombres propios en mayúsculas/minúsculas estándar.
- Las fechas siguen el formato ISO 8601 (YYYY-MM-DD).
- La cuantía es un número sin símbolo de moneda ni separadores de miles.
- tipo_vista: devuelve exactamente "PRESENCIAL" o "TELEMÁTICA".
- inicio_acto: devuelve exactamente "AUDIENCIA_PREVIA" o "JUICIO".
- cuantia: extrae siempre del EMPLAZAMIENTO, no de la demanda.
- acciones_ejercitadas y excepciones_procesales y hechos_controvertidos: devuelve array de strings.`

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

// ── Sección Informe PDF ────────────────────────────────────────────────────
type InformeTab = 'encabezado' | 'secciones' | 'estilo' | 'preview'

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

  const loadConfig = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('report_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

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

  // Tabs internas
  const TABS: { id: InformeTab; label: string; Icon: React.ElementType }[] = [
    { id: 'encabezado', label: 'Encabezado',  Icon: Building2 },
    { id: 'secciones',  label: 'Secciones',   Icon: LayoutList },
    { id: 'estilo',     label: 'Estilo',      Icon: Palette },
    { id: 'preview',    label: 'Vista previa',Icon: Monitor },
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
              {activeSection === 'analisis'       && <AnalisisSection />}
              {activeSection === 'notificaciones' && <NotificacionesSection />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
