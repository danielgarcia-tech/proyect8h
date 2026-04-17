import { useState, useRef, useCallback, useEffect } from 'react'
import type { DragEvent, ChangeEvent, FormEvent } from 'react'
import {
  FileText,
  File,
  X,
  CheckCircle2,
  Download,
  RotateCcw,
  AlertCircle,
  UploadCloud,
  Gavel,
  ScrollText,
  Bell,
  FilePlus,
  ArrowRight,
  Hash,
  ShieldAlert,
} from 'lucide-react'
import type { UploadedFile } from '../types'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { extractTextFromFile } from '../lib/extractText'
import { callAI } from '../lib/aiCalling'
import { generatePdf } from '../lib/generatePdf'
import type { ExtractionField, ReportConfig, AnalysisResult, ExcepcionConfig } from '../lib/generatePdf'
import { DEFAULT_FIELDS, DEFAULT_SYSTEM_PROMPT, DEFAULT_AI_MODEL } from '../lib/aiDefaults'

// ── Slots ─────────────────────────────────────────────────────────────────
const DOC_SLOTS = [
  {
    id: 'demanda',
    label: 'Demanda',
    description: 'Escrito inicial de la acción',
    Icon: Gavel,
    color: '#3B82F6',
    lightBg: '#EFF6FF',
    border: '#BFDBFE',
    tag: '#DBEAFE',
    tagText: '#1D4ED8',
  },
  {
    id: 'contestacion',
    label: 'Contestación',
    description: 'Respuesta del demandado',
    Icon: ScrollText,
    color: '#8B5CF6',
    lightBg: '#F5F3FF',
    border: '#DDD6FE',
    tag: '#EDE9FE',
    tagText: '#6D28D9',
  },
  {
    id: 'emplazamiento',
    label: 'Emplazamiento',
    description: 'Notificación judicial',
    Icon: Bell,
    color: '#F59E0B',
    lightBg: '#FFFBEB',
    border: '#FDE68A',
    tag: '#FEF3C7',
    tagText: '#B45309',
  },
  {
    id: 'sac',
    label: 'Reclamación SAC',
    description: 'PDF de reclamación al Servicio de Atención al Cliente',
    Icon: FilePlus,
    color: '#059669',
    lightBg: '#ECFDF5',
    border: '#A7F3D0',
    tag: '#D1FAE5',
    tagText: '#065F46',
  },
  {
    id: 'otro',
    label: 'Otro documento',
    description: 'Documentación adicional',
    Icon: FilePlus,
    color: '#6B7280',
    lightBg: '#F9FAFB',
    border: '#E5E7EB',
    tag: '#F3F4F6',
    tagText: '#374151',
  },
] as const

type SlotId = typeof DOC_SLOTS[number]['id']
interface SlotFile extends UploadedFile { slotId: SlotId }


type Step = 'upload' | 'processing' | 'review' | 'result'
const STATUS_MESSAGES = [
  'Extrayendo texto de los documentos...',
  'Analizando cláusulas con IA...',
  'Identificando partes y riesgos...',
  'Generando informe jurídico...',
]

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

// ── Stepper ────────────────────────────────────────────────────────────────
function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'upload', label: 'Documentos' },
    { id: 'processing', label: 'Procesando' },
    { id: 'result', label: 'Resultado' },
  ]
  const ci = steps.findIndex((s) => s.id === step)
  return (
    <nav aria-label="Pasos" className="flex items-center gap-0 mb-10">
      {steps.map((s, i) => {
        const done = i < ci
        const active = i === ci
        return (
          <div key={s.id} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                done    ? 'bg-[#2B58C4] text-white'
                : active ? 'bg-[#2B58C4] text-white shadow-[0_0_0_4px_rgba(43,88,196,0.12)]'
                         : 'bg-gray-200 text-gray-400'
              }`} aria-current={active ? 'step' : undefined}>
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs font-semibold ${active ? 'text-[#2B58C4]' : done ? 'text-gray-500' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`mx-3 h-px w-8 ${done ? 'bg-[#2B58C4]' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </nav>
  )
}

// ── Helper: nombre del dispositivo ────────────────────────────────────────
function getDeviceName(): string {
  const ua = navigator.userAgent
  let os = 'Dispositivo'
  if      (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac'))     os = 'macOS'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
  else if (ua.includes('Linux'))   os = 'Linux'
  let browser = ''
  if      (ua.includes('Edg'))                              browser = 'Edge'
  else if (ua.includes('Chrome') && !ua.includes('Edg'))   browser = 'Chrome'
  else if (ua.includes('Firefox'))                          browser = 'Firefox'
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
  return browser ? `${browser} / ${os}` : os
}

// ── Modal código Aranzadi ──────────────────────────────────────────────────
function AranzadiModal({
  onConfirm, onCancel,
}: {
  onConfirm: (codigo: string) => void
  onCancel: () => void
}) {
  const [codigo, setCodigo] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = codigo.trim()
    if (trimmed) onConfirm(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />

      {/* Panel */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 border border-gray-100">
        {/* Icono */}
        <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center mb-4">
          <Hash className="w-5 h-5 text-[#2B58C4]" />
        </div>

        <h3 className="text-base font-bold text-gray-900 mb-1">Código Aranzadi</h3>
        <p className="text-xs text-gray-400 mb-5">
          Introduce el código del expediente. Quedará registrado en el historial de análisis.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ej. 28079470120240012345"
            className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 bg-white placeholder-gray-300 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/30 focus:border-[#2B58C4] transition font-mono"
          />
          <div className="flex gap-2.5">
            <button type="button" onClick={onCancel}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition focus:outline-none">
              Cancelar
            </button>
            <button type="submit" disabled={!codigo.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2B58C4] hover:bg-[#2348A8] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition focus:outline-none focus:ring-2 focus:ring-[#2B58C4] focus:ring-offset-2">
              Analizar
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tarjeta de documento ───────────────────────────────────────────────────
function DocSlotCard({
  slot, file, onFile, onRemove,
}: {
  slot: typeof DOC_SLOTS[number]
  file: SlotFile | undefined
  onFile: (id: SlotId, f: File) => void
  onRemove: (id: SlotId) => void
}) {
  const [drag, setDrag] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const { Icon } = slot
  const ACCEPTED = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  function accept(list: FileList | null) {
    if (!list?.length) return
    const f = list[0]
    if (f.type === 'application/pdf' || f.type.includes('wordprocessingml')) onFile(slot.id, f)
  }

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDrag(false); accept(e.dataTransfer.files)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot.id])

  return (
    <div
      role="button"
      tabIndex={file ? -1 : 0}
      aria-label={`Zona de carga para ${slot.label}`}
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onClick={() => !file && ref.current?.click()}
      onKeyDown={(e) => { if (!file && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ref.current?.click() } }}
      className={`relative flex flex-col rounded-2xl border-2 cursor-pointer select-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2B58C4] ${
        file
          ? 'cursor-default border-gray-200 bg-white shadow-sm'
          : drag
          ? 'border-[#2B58C4] bg-[#F0F4FF] shadow-md scale-[1.01]'
          : 'border-dashed border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <input ref={ref} type="file" accept={ACCEPTED} className="sr-only" tabIndex={-1}
        onChange={(e: ChangeEvent<HTMLInputElement>) => { accept(e.target.files); e.target.value = '' }} />

      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: slot.lightBg }}>
            <Icon className="w-4 h-4" style={{ color: slot.color }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 leading-tight">{slot.label}</p>
            <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{slot.description}</p>
          </div>
        </div>
        {file && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: slot.tag, color: slot.tagText }}>
            Añadido
          </span>
        )}
      </div>

      {/* Separador */}
      <div className="mx-4 h-px bg-gray-100" />

      {/* Cuerpo */}
      <div className="flex-1 flex items-center px-4 py-4">
        {file ? (
          <div className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 border"
            style={{ backgroundColor: slot.lightBg, borderColor: slot.border }}>
            {file.type === 'application/pdf'
              ? <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
              : <File className="w-4 h-4 text-blue-400 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700 truncate">{file.name}</p>
              <p className="text-[10px] text-gray-400">{formatBytes(file.size)}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(slot.id) }}
              aria-label={`Quitar ${file.name}`}
              className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors focus:outline-none focus:ring-1 focus:ring-red-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center justify-center gap-1.5 py-3">
            <UploadCloud className={`w-7 h-7 transition-colors ${drag ? 'text-[#2B58C4]' : 'text-gray-300'}`} />
            <p className="text-xs text-gray-400 text-center">
              <span className="font-semibold text-[#2B58C4]">Selecciona</span> o arrastra aquí
            </p>
            <p className="text-[10px] text-gray-300">PDF · DOCX</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Step 1: Upload ─────────────────────────────────────────────────────────
function UploadStep({
  slotFiles, onFile, onRemove, onAnalyze,
}: {
  slotFiles: Partial<Record<SlotId, SlotFile>>
  onFile: (id: SlotId, f: File) => void
  onRemove: (id: SlotId) => void
  onAnalyze: () => void
}) {
  const total = Object.keys(slotFiles).length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        {DOC_SLOTS.map((slot, i) => (
          <div key={slot.id} className={DOC_SLOTS.length % 2 !== 0 && i === DOC_SLOTS.length - 1 ? 'col-span-2' : ''}>
            <DocSlotCard slot={slot} file={slotFiles[slot.id]} onFile={onFile} onRemove={onRemove} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1">
            {DOC_SLOTS.map((s) => (
              <div key={s.id} className="w-1.5 h-1.5 rounded-full transition-colors"
                style={{ backgroundColor: slotFiles[s.id] ? '#2B58C4' : '#E5E7EB' }} />
            ))}
          </div>
          <span className="text-xs text-gray-400">
            {total === 0
              ? 'Añade al menos un documento'
              : `${total} documento${total !== 1 ? 's' : ''} listo${total !== 1 ? 's' : ''}`}
          </span>
        </div>
        <button
          onClick={onAnalyze}
          disabled={total === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#2B58C4] hover:bg-[#2348A8] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-[#2B58C4] focus:ring-offset-2"
        >
          Analizar
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Step 2: Processing ─────────────────────────────────────────────────────
function ProcessingStep({ progress, truncatedFiles }: {
  progress: number
  truncatedFiles: Array<{ name: string; total: number; processed: number }>
}) {
  const mi = Math.min(Math.floor(progress / 25), STATUS_MESSAGES.length - 1)
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="relative mb-8">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="#F3F4F6" strokeWidth="4" />
          <circle cx="32" cy="32" r="28" fill="none" stroke="#2B58C4" strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 28}`}
            strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
            strokeLinecap="round" className="transition-all duration-500" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-[#2B58C4]">{progress}%</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-800 mb-1">Analizando documentos</p>
      <p className="text-xs text-gray-400">{STATUS_MESSAGES[mi]}</p>

      {truncatedFiles.length > 0 && (
        <div className="mt-8 w-full max-w-sm text-left flex items-start gap-3 px-4 py-3.5
                        bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800 mb-1">Documento extenso detectado</p>
            {truncatedFiles.map((f, i) => (
              <p key={i} className="text-[11px] text-amber-700 leading-relaxed">
                <span className="font-mono font-medium">{f.name}</span> tiene {f.total} páginas —
                se analizarán solo las primeras <strong>{f.processed}</strong>.
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 3: Result ─────────────────────────────────────────────────────────
function ResultStep({
  slotFiles, onDownload, onNewAnalysis, downloadError,
}: {
  slotFiles: Partial<Record<SlotId, SlotFile>>
  onDownload: () => void
  onNewAnalysis: () => void
  downloadError: string | null
}) {
  const files = Object.values(slotFiles) as SlotFile[]
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mb-5">
        <CheckCircle2 className="w-7 h-7 text-green-500" />
      </div>
      <p className="text-base font-bold text-gray-900 mb-1">Análisis completado</p>
      <p className="text-xs text-gray-400 mb-6">
        {files.length} documento{files.length !== 1 ? 's' : ''} procesado{files.length !== 1 ? 's' : ''} correctamente
      </p>

      <ul className="w-full max-w-xs space-y-2 mb-7 text-left">
        {files.map((f) => {
          const slot = DOC_SLOTS.find((s) => s.id === f.slotId) ?? DOC_SLOTS[3]
          const { Icon } = slot
          return (
            <li key={f.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border"
              style={{ backgroundColor: slot.lightBg, borderColor: slot.border }}>
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: slot.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: slot.tagText }}>{slot.label}</p>
                <p className="text-xs text-gray-700 truncate">{f.name}</p>
              </div>
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
            </li>
          )
        })}
      </ul>

      {downloadError && (
        <div role="alert" className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 w-full max-w-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{downloadError}
        </div>
      )}

      <div className="flex gap-2.5 w-full max-w-xs">
        <button onClick={onDownload}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2B58C4] hover:bg-[#2348A8] text-white text-sm font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#2B58C4] focus:ring-offset-2">
          <Download className="w-4 h-4" />Descargar informe
        </button>
        <button onClick={onNewAnalysis}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2">
          <RotateCcw className="w-4 h-4" />Nuevo análisis
        </button>
      </div>
    </div>
  )
}

// ── Modal de revisión post-análisis ───────────────────────────────────────
type ReviewSection = 'procedimiento' | 'partes' | 'vista' | 'acciones' | 'excepcion' | 'hechos'

const REVIEW_SECTIONS: { id: ReviewSection; label: string; icon: string }[] = [
  { id: 'procedimiento', label: 'Procedimiento', icon: '⚖️' },
  { id: 'partes',        label: 'Partes',        icon: '👥' },
  { id: 'vista',         label: 'Vista',         icon: '🗓️' },
  { id: 'acciones',      label: 'Acciones',      icon: '📋' },
  { id: 'excepcion',     label: 'Excepción',     icon: '🛡️' },
  { id: 'hechos',        label: 'Hechos',        icon: '📖' },
]

function toArr(v: unknown): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v.map(String)
  return [String(v)]
}

function ReviewField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/25 focus:border-[#2B58C4] transition" />
    </div>
  )
}

function ReviewSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/25 focus:border-[#2B58C4] transition appearance-none">
        <option value="">— Sin especificar —</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function ReviewList({ label, items, onChange, color }: {
  label: string; items: string[]; onChange: (v: string[]) => void; color: string
}) {
  const update = (i: number, v: string) => { const n = [...items]; n[i] = v; onChange(n) }
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i))
  const add    = () => onChange([...items, ''])
  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</label>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ backgroundColor: color }}>{i+1}</span>
          <input type="text" value={item} onChange={(e) => update(i, e.target.value)}
            className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/25 focus:border-[#2B58C4] transition" />
          <button onClick={() => remove(i)} className="p-1 text-gray-300 hover:text-red-400 rounded focus:outline-none"><X className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg border border-dashed border-gray-200 hover:border-gray-300 transition w-full justify-center focus:outline-none">
        <span className="text-base leading-none">+</span> Añadir
      </button>
    </div>
  )
}

function ReviewModal({ data: initial, codigoAranzadi, excepcionesConfig = [], onConfirm, onCancel }: {
  data: AnalysisResult
  codigoAranzadi: string
  excepcionesConfig?: ExcepcionConfig[]
  onConfirm: (data: AnalysisResult) => void
  onCancel: () => void
}) {
  const [data, setData] = useState<Record<string, unknown>>({ ...initial })
  const [active, setActive] = useState<ReviewSection>('procedimiento')
  const g = (k: string) => String(data[k] ?? '')
  const set = (k: string, v: unknown) => setData((p) => ({ ...p, [k]: v }))

  // ── helpers para el catálogo de excepciones ──
  const excItems: string[] = toArr(data['excepciones_procesales'])

  function isCatalogActive(nombre: string) {
    const n = nombre.trim().toLowerCase()
    return excItems.some((i) => i.trim().toLowerCase() === n || i.trim().toLowerCase().includes(n))
  }

  function toggleCatalogItem(nombre: string) {
    if (isCatalogActive(nombre)) {
      const next = excItems.filter((i) => {
        const il = i.trim().toLowerCase()
        const nl = nombre.trim().toLowerCase()
        return il !== nl && !il.includes(nl)
      })
      set('excepciones_procesales', next.length ? next : null)
    } else {
      set('excepciones_procesales', [...excItems, nombre])
    }
  }

  function updateCustomExc(newCustom: string[]) {
    const catalogActivos = excepcionesConfig.filter((c) => isCatalogActive(c.nombre)).map((c) => c.nombre)
    const merged = [...catalogActivos, ...newCustom]
    set('excepciones_procesales', merged.length ? merged : null)
  }

  const customExcItems = excItems.filter((item) =>
    !excepcionesConfig.some((c) => {
      const n = c.nombre.trim().toLowerCase()
      return item.trim().toLowerCase() === n || item.trim().toLowerCase().includes(n)
    })
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Revisión del análisis</p>
            <p className="text-sm font-bold text-gray-900 font-mono">{codigoAranzadi}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition focus:outline-none">Cancelar</button>
            <button onClick={() => onConfirm(data as AnalysisResult)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#2B58C4] hover:bg-[#2348A8] rounded-xl transition focus:outline-none">
              <CheckCircle2 className="w-4 h-4" />Confirmar y guardar
            </button>
          </div>
        </div>

        {/* Tabs de sección */}
        <div className="flex gap-1 px-4 pt-3 pb-0 flex-wrap">
          {REVIEW_SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setActive(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition focus:outline-none ${
                active === s.id ? 'bg-[#2B58C4] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              <span>{s.icon}</span>{s.label}
            </button>
          ))}
        </div>

        {/* Contenido sección */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {active === 'procedimiento' && <>
            <ReviewField label="NIG" value={g('NIG')} onChange={(v) => set('NIG', v)} />
            <div className="grid grid-cols-2 gap-4">
              <ReviewSelect label="Tipo de procedimiento" value={g('procedimiento')} onChange={(v) => set('procedimiento', v)}
                options={[{value:'Juicio Verbal',label:'Juicio Verbal'},{value:'Juicio Ordinario',label:'Juicio Ordinario'},{value:'Monitorio',label:'Monitorio'},{value:'Cambiario',label:'Cambiario'}]} />
              <ReviewField label="Número de autos" value={g('numero_autos')} onChange={(v) => set('numero_autos', v)} />
            </div>
            <ReviewField label="Juzgado competente" value={g('juzgado')} onChange={(v) => set('juzgado', v)} />
            <div className="grid grid-cols-2 gap-4">
              <ReviewField label="Cuantía (€)" value={g('cuantia')} onChange={(v) => set('cuantia', v)} />
              <ReviewField label="Fecha presentación" value={g('fecha_presentacion')} onChange={(v) => set('fecha_presentacion', v)} />
            </div>
          </>}

          {active === 'partes' && <>
            <div className="grid grid-cols-2 gap-4">
              <ReviewField label="Demandante" value={g('demandante')} onChange={(v) => set('demandante', v)} />
              <ReviewField label="Demandado" value={g('demandado')} onChange={(v) => set('demandado', v)} />
              <ReviewField label="Procurador" value={g('procurador')} onChange={(v) => set('procurador', v)} />
              <ReviewField label="Abogado / Letrado" value={g('abogado')} onChange={(v) => set('abogado', v)} />
            </div>
          </>}

          {active === 'vista' && <>
            <div className="grid grid-cols-2 gap-4">
              <ReviewField label="Día de vista (YYYY-MM-DD)" value={g('dia_vista')} onChange={(v) => set('dia_vista', v)} />
              <ReviewSelect label="Tipo de vista" value={g('tipo_vista')} onChange={(v) => set('tipo_vista', v)}
                options={[{value:'PRESENCIAL',label:'Presencial'},{value:'TELEMÁTICA',label:'Telemática'}]} />
              <ReviewSelect label="Inicio del acto" value={g('inicio_acto')} onChange={(v) => set('inicio_acto', v)}
                options={[{value:'AUDIENCIA_PREVIA',label:'Audiencia previa'},{value:'JUICIO',label:'Juicio'}]} />
              <ReviewField label="Teléfono incidencias" value={g('telefono_incidencias')} onChange={(v) => set('telefono_incidencias', v)} />
            </div>
          </>}

          {active === 'acciones' && (
            <ReviewList label="Acciones ejercitadas (SOLICITO)" items={toArr(data['acciones_ejercitadas'])}
              onChange={(v) => set('acciones_ejercitadas', v)} color="#059669" />
          )}

          {active === 'excepcion' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Excepciones procesales alegadas por el demandado. Selecciona del catálogo o añade libremente.</span>
              </div>

              {/* Catálogo */}
              {excepcionesConfig.length > 0 && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Del catálogo configurado</label>
                  <div className="flex flex-wrap gap-2">
                    {excepcionesConfig.map((c) => {
                      const active = isCatalogActive(c.nombre)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCatalogItem(c.nombre)}
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

              {/* Libres */}
              <ReviewList
                label={excepcionesConfig.length > 0 ? 'Excepciones personalizadas (texto libre)' : 'Excepciones procesales'}
                items={customExcItems}
                onChange={updateCustomExc}
                color="#DC2626"
              />
            </div>
          )}

          {active === 'hechos' && (
            <ReviewList label="Hechos controvertidos" items={toArr(data['hechos_controvertidos'])}
              onChange={(v) => set('hechos_controvertidos', v)} color="#0891B2" />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function NewAnalysisPage({ user }: { user: User }) {
  const [step,            setStep]            = useState<Step>('upload')
  const [slotFiles,       setSlotFiles]       = useState<Partial<Record<SlotId, SlotFile>>>({})
  const [progress,        setProgress]        = useState(0)
  const [truncatedFiles,  setTruncatedFiles]  = useState<Array<{ name: string; total: number; processed: number }>>([])
  const [downloadError,   setDownloadError]   = useState<string | null>(null)
  const [analysisError,   setAnalysisError]   = useState<string | null>(null)
  const [analysisResult,  setAnalysisResult]  = useState<AnalysisResult | null>(null)
  const [aiFields,          setAiFields]          = useState<ExtractionField[]>(DEFAULT_FIELDS)
  const [aiModel,           setAiModel]           = useState(DEFAULT_AI_MODEL)
  const [aiPrompt,          setAiPrompt]          = useState(DEFAULT_SYSTEM_PROMPT)
  const [reportCfg,         setReportCfg]         = useState<ReportConfig | null>(null)
  const [excepcionesConfig, setExcepcionesConfig] = useState<ExcepcionConfig[]>([])
  const [showAranzadi,      setShowAranzadi]      = useState(false)
  const [codigoAranzadi,    setCodigoAranzadi]    = useState('')
  const [showReview,        setShowReview]        = useState(false)

  // Carga config de IA y de informe al montar; los defaults se mantienen si no hay datos en BD
  useEffect(() => {
    async function loadConfigs() {
      const [{ data: aiData }, { data: rptData }, { data: excData }] = await Promise.all([
        supabase.from('ai_bias').select('model, system_prompt, fields').eq('user_id', user.id).maybeSingle(),
        supabase.from('report_config').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('excepciones_procesales').select('id, nombre, texto_asociado').eq('user_id', user.id),
      ])
      if (Array.isArray(aiData?.fields) && aiData.fields.length > 0) setAiFields(aiData.fields as ExtractionField[])
      if (aiData?.model)         setAiModel(aiData.model as string)
      if (aiData?.system_prompt) setAiPrompt(aiData.system_prompt as string)
      if (rptData) setReportCfg(rptData as ReportConfig)
      if (Array.isArray(excData)) setExcepcionesConfig(excData as ExcepcionConfig[])
    }
    loadConfigs()
  }, [user.id])

  function handleFile(slotId: SlotId, f: File) {
    setSlotFiles((p) => ({
      ...p,
      [slotId]: { id: `${slotId}-${Date.now()}`, name: f.name, size: f.size, type: f.type, file: f, status: 'pending', slotId },
    }))
  }

  function handleRemove(slotId: SlotId) {
    setSlotFiles((p) => { const n = { ...p }; delete n[slotId]; return n })
  }

  // Abre el modal para pedir el código Aranzadi
  function handleRequestAnalyze() {
    setShowAranzadi(true)
  }

  // Llamado desde el modal al confirmar el código
  async function handleAnalyze(codigo: string) {
    setShowAranzadi(false)
    setCodigoAranzadi(codigo)
    setStep('processing'); setProgress(0); setAnalysisError(null); setTruncatedFiles([])
    let tick = 0
    let failed = false
    const iv = setInterval(() => { tick++; setProgress((p) => Math.min(p + Math.max(1, 8 - tick), 90)) }, 600)
    try {
      // ── 1. Extraer texto de cada documento ──
      const truncated: Array<{ name: string; total: number; processed: number }> = []
      const textEntries = await Promise.all(
        Object.entries(slotFiles).map(async ([slotId, slotFile]) => {
          const result = await extractTextFromFile(slotFile!.file as File)
          if (result.truncated) {
            truncated.push({ name: slotFile!.file.name, ...result.truncated })
          }
          return [slotId, result.text] as [string, string]
        }),
      )
      if (truncated.length > 0) setTruncatedFiles(truncated)
      const texts = Object.fromEntries(textEntries)

      // ── 2. Llamar a Claude ──
      const result = await callAI({
        texts,
        model: aiModel,
        system_prompt: aiPrompt,
        fields: aiFields,
      })

      setAnalysisResult(result)
      setShowReview(true)
    } catch (err) {
      failed = true
      const msg = err instanceof Error ? err.message : 'Error desconocido al analizar los documentos'
      setAnalysisError(msg)
    } finally {
      clearInterval(iv)
      if (failed) {
        setProgress(0)
        setStep('upload')
      } else {
        setProgress(100)
        setStep('result')
      }
    }
  }

  async function handleConfirmReview(confirmedData: AnalysisResult) {
    setShowReview(false)
    setAnalysisResult(confirmedData)
    await supabase.from('historial_analisis').insert({
      user_id:         user.id,
      codigo_aranzadi: codigoAranzadi,
      equipo:          getDeviceName(),
      documentos:      Object.values(slotFiles).map((f) => f!.name),
      resultado:       confirmedData,
    })
  }

  function handleDownload() {
    if (!analysisResult) return
    setDownloadError(null)
    try {
      const defaultSections = [
        { id: 'portada',      title: 'Portada',                  subtitle: '', enabled: true },
        { id: 'timeline',     title: 'Cronología del asunto',    subtitle: '', enabled: true },
        { id: 'calendario',   title: 'Calendario procesal',      subtitle: '', enabled: true },
        { id: 'acciones',     title: 'Acciones ejercitadas',     subtitle: '', enabled: true },
        { id: 'excepciones',  title: 'Excepciones procesales',   subtitle: '', enabled: true },
        { id: 'hechos',       title: 'Hechos controvertidos',    subtitle: '', enabled: true },
        { id: 'datos',        title: 'Datos adicionales',        subtitle: '', enabled: false },
        { id: 'conclusiones', title: 'Conclusiones',             subtitle: '', enabled: true },
      ]
      const cfg: ReportConfig = reportCfg ?? {
        firm_name: '', firm_tagline: '', firm_address: '',
        firm_phone: '', firm_email: '', firm_web: '',
        footer_text: 'Documento generado automáticamente por ONLY8H · Confidencial',
        primary_color: '#2B58C4', secondary_color: '#F8FAFC',
        font_size: 'normal', sections: defaultSections,
      }
      generatePdf(analysisResult, aiFields, cfg, excepcionesConfig)
    } catch (e) {
      console.error(e)
      setDownloadError('No se pudo generar el PDF. Inténtalo de nuevo.')
    }
  }

  function handleNewAnalysis() {
    setSlotFiles({}); setProgress(0); setDownloadError(null); setAnalysisError(null)
    setAnalysisResult(null); setShowReview(false); setStep('upload')
  }

  return (
    <>
    {showAranzadi && (
      <AranzadiModal
        onConfirm={handleAnalyze}
        onCancel={() => setShowAranzadi(false)}
      />
    )}
    {showReview && analysisResult && (
      <ReviewModal
        data={analysisResult}
        codigoAranzadi={codigoAranzadi}
        excepcionesConfig={excepcionesConfig}
        onConfirm={handleConfirmReview}
        onCancel={() => { setShowReview(false); setStep('upload') }}
      />
    )}
    <div className="min-h-full flex flex-col items-center justify-start py-10 px-6">
      <div className="w-full max-w-2xl">
        {/* Encabezado */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Nuevo análisis</h2>
          <p className="text-sm text-gray-400 mt-1.5">
            Adjunta los documentos del procedimiento y obtén un informe jurídico con IA.
          </p>
        </div>

        <Stepper step={step} />

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {step === 'upload' && (
            <>
              {analysisError && (
                <div role="alert" className="mb-5 flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{analysisError}</span>
                </div>
              )}
              <UploadStep slotFiles={slotFiles} onFile={handleFile} onRemove={handleRemove} onAnalyze={handleRequestAnalyze} />
            </>
          )}
          {step === 'processing' && <ProcessingStep progress={progress} truncatedFiles={truncatedFiles} />}
          {step === 'result' && (
            <ResultStep slotFiles={slotFiles} onDownload={handleDownload} onNewAnalysis={handleNewAnalysis} downloadError={downloadError} />
          )}
        </div>
      </div>
    </div>
    </>
  )
}
