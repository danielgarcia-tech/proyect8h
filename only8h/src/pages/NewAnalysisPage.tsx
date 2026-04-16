import { useState, useRef, useCallback, useEffect } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
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
} from 'lucide-react'
import type { UploadedFile } from '../types'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { generatePdf } from '../lib/generatePdf'
import type { ExtractionField, ReportConfig, AnalysisResult } from '../lib/generatePdf'

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

// Resultado simulado para demo — se reemplazará por la respuesta real de Claude
const MOCK_RESULT: AnalysisResult = {
  NIG:                    '28079470120240012345',
  procedimiento:          'Juicio Verbal',
  juzgado:                'Juzgado de 1.ª Instancia n.º 3 de Madrid',
  numero_autos:           '456/2024',
  dia_vista:              '2024-11-15',
  telefono_incidencias:   '91 700 00 00',
  tipo_vista:             'TELEMÁTICA',
  demandante:             'Juan García López',
  demandado:              'Entidad Financiera S.A.',
  procurador:             'D.ª María Fernández Ruiz',
  abogado:                'D. Carlos Martínez Pérez',
  cuantia:                4823.50,
  acciones_ejercitadas:   [
    'Declarar la nulidad del contrato de tarjeta revolving por usura',
    'Condenar a la restitución de 4.823,50 € cobrados en exceso',
    'Declarar la nulidad de las cláusulas de interés y sistema revolving',
    'Expresa condena en costas a la entidad demandada',
  ],
  inicio_acto:            'JUICIO',
  excepciones_procesales: null,
  hechos_controvertidos:  [
    'El demandado niega que el tipo de interés sea usurario',
    'Alega que el consumidor fue informado de las condiciones del contrato',
    'Sostiene que la TAE estaba dentro de los límites del mercado en la fecha de suscripción',
  ],
  fecha_presentacion:     '2024-03-01',
}

type Step = 'upload' | 'processing' | 'result'
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
        {DOC_SLOTS.map((slot) => (
          <DocSlotCard key={slot.id} slot={slot} file={slotFiles[slot.id]} onFile={onFile} onRemove={onRemove} />
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
function ProcessingStep({ progress }: { progress: number }) {
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

// ── Main page ──────────────────────────────────────────────────────────────
export default function NewAnalysisPage({ user }: { user: User }) {
  const [step,          setStep]          = useState<Step>('upload')
  const [slotFiles,     setSlotFiles]     = useState<Partial<Record<SlotId, SlotFile>>>({})
  const [progress,      setProgress]      = useState(0)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [analysisResult,setAnalysisResult]= useState<AnalysisResult>(MOCK_RESULT)
  const [aiFields,      setAiFields]      = useState<ExtractionField[]>([])
  const [reportCfg,     setReportCfg]     = useState<ReportConfig | null>(null)

  // Carga config de IA y de informe al montar
  useEffect(() => {
    async function loadConfigs() {
      const [{ data: aiData }, { data: rptData }] = await Promise.all([
        supabase.from('ai_bias').select('fields').eq('user_id', user.id).maybeSingle(),
        supabase.from('report_config').select('*').eq('user_id', user.id).maybeSingle(),
      ])
      if (aiData?.fields?.length) setAiFields(aiData.fields as ExtractionField[])
      if (rptData) setReportCfg(rptData as ReportConfig)
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

  async function handleAnalyze() {
    setStep('processing'); setProgress(0)
    let tick = 0
    const iv = setInterval(() => { tick++; setProgress((p) => Math.min(p + Math.max(1, 8 - tick), 90)) }, 600)
    try {
      // TODO: llamar a Supabase Edge Function → Claude API y guardar resultado real
      // Por ahora usa el resultado simulado
      await new Promise((r) => setTimeout(r, 800))
      setAnalysisResult(MOCK_RESULT)
    } finally {
      clearInterval(iv); setProgress(100); setTimeout(() => setStep('result'), 400)
    }
  }

  function handleDownload() {
    setDownloadError(null)
    try {
      const defaultSections = [
        { id: 'portada',      title: 'Portada',                 subtitle: '', enabled: true },
        { id: 'datos',        title: 'Datos del procedimiento', subtitle: '', enabled: true },
        { id: 'acciones',     title: 'Acciones ejercitadas',    subtitle: '', enabled: true },
        { id: 'calendario',   title: 'Calendario procesal',     subtitle: '', enabled: true },
        { id: 'excepciones',  title: 'Excepciones procesales',  subtitle: '', enabled: true },
        { id: 'hechos',       title: 'Hechos controvertidos',   subtitle: '', enabled: true },
        { id: 'conclusiones', title: 'Conclusiones',            subtitle: '', enabled: true },
      ]
      const cfg: ReportConfig = reportCfg ?? {
        firm_name: '', firm_tagline: '', firm_address: '',
        firm_phone: '', firm_email: '', firm_web: '',
        footer_text: 'Documento generado automáticamente por ONLY8H · Confidencial',
        primary_color: '#2B58C4', secondary_color: '#F8FAFC',
        font_size: 'normal', sections: defaultSections,
      }
      generatePdf(analysisResult, aiFields, cfg)
    } catch (e) {
      console.error(e)
      setDownloadError('No se pudo generar el PDF. Inténtalo de nuevo.')
    }
  }

  function handleNewAnalysis() {
    setSlotFiles({}); setProgress(0); setDownloadError(null); setStep('upload')
  }

  return (
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
            <UploadStep slotFiles={slotFiles} onFile={handleFile} onRemove={handleRemove} onAnalyze={handleAnalyze} />
          )}
          {step === 'processing' && <ProcessingStep progress={progress} />}
          {step === 'result' && (
            <ResultStep slotFiles={slotFiles} onDownload={handleDownload} onNewAnalysis={handleNewAnalysis} downloadError={downloadError} />
          )}
        </div>
      </div>
    </div>
  )
}
