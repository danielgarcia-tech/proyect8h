import { useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { saveAs } from 'file-saver'
import { FileText, Download, AlertCircle, Settings, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { renderEscrito } from '../lib/escritoTemplate'
import type { TemplateField } from '../lib/escritoTemplate'

const TIPO_ESCRITO_DEMANDA = 'demanda'

interface Plantilla {
  id: string
  tipoEscrito: string
  nombre: string
  storagePath: string
  campos: TemplateField[]
}

type FormValue = string | string[]

function emptyValueFor(field: TemplateField): FormValue {
  return field.tipo === 'lista' ? [] : ''
}

function TextField({ field, value, onChange }: { field: TemplateField; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {field.label}{field.requerido && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/25 focus:border-[#2B58C4] transition" />
    </div>
  )
}

function TextAreaField({ field, value, onChange }: { field: TemplateField; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {field.label}{field.requerido && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4}
        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/25 focus:border-[#2B58C4] transition" />
    </div>
  )
}

function DateField({ field, value, onChange }: { field: TemplateField; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {field.label}{field.requerido && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/25 focus:border-[#2B58C4] transition" />
    </div>
  )
}

function NumberField({ field, value, onChange }: { field: TemplateField; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {field.label}{field.requerido && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/25 focus:border-[#2B58C4] transition" />
    </div>
  )
}

function ListField({ field, items, onChange }: { field: TemplateField; items: string[]; onChange: (v: string[]) => void }) {
  const update = (i: number, v: string) => { const n = [...items]; n[i] = v; onChange(n) }
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i))
  const add    = () => onChange([...items, ''])
  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {field.label}{field.requerido && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 bg-[#2B58C4]">{i + 1}</span>
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

function DynamicField({ field, value, onChange }: { field: TemplateField; value: FormValue; onChange: (v: FormValue) => void }) {
  switch (field.tipo) {
    case 'lista':    return <ListField field={field} items={value as string[]} onChange={onChange} />
    case 'textarea': return <TextAreaField field={field} value={value as string} onChange={onChange} />
    case 'fecha':    return <DateField field={field} value={value as string} onChange={onChange} />
    case 'numero':   return <NumberField field={field} value={value as string} onChange={onChange} />
    default:         return <TextField field={field} value={value as string} onChange={onChange} />
  }
}

function isFieldFilled(value: FormValue): boolean {
  if (Array.isArray(value)) return value.some((v) => v.trim().length > 0)
  return value.trim().length > 0
}

export default function NewEscritoPage({ user }: { user: User }) {
  const [loading,    setLoading]    = useState(true)
  const [plantilla,  setPlantilla]  = useState<Plantilla | null>(null)
  const [values,     setValues]     = useState<Record<string, FormValue>>({})
  const [referencia, setReferencia] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [generated,  setGenerated]  = useState(false)

  const loadPlantilla = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('instructas_plantillas')
      .select('*')
      .eq('user_id', user.id)
      .eq('tipo_escrito', TIPO_ESCRITO_DEMANDA)
      .maybeSingle()

    if (data) {
      const campos = Array.isArray(data.campos) ? (data.campos as TemplateField[]) : []
      setPlantilla({ id: data.id, tipoEscrito: data.tipo_escrito, nombre: data.nombre, storagePath: data.storage_path, campos })
      setValues(Object.fromEntries(campos.map((f) => [f.key, emptyValueFor(f)])))
    }
    setLoading(false)
  }, [user.id])

  useEffect(() => { loadPlantilla() }, [loadPlantilla])

  function setFieldValue(key: string, value: FormValue) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setGenerated(false)
  }

  async function handleGenerate() {
    if (!plantilla) return
    setError(null)

    const missing = plantilla.campos.filter((f) => f.requerido && !isFieldFilled(values[f.key] ?? emptyValueFor(f)))
    if (missing.length > 0) {
      setError(`Faltan campos obligatorios: ${missing.map((f) => f.label).join(', ')}`)
      return
    }

    setGenerating(true)
    try {
      const { data: fileBlob, error: downloadErr } = await supabase.storage
        .from('instructas-plantillas')
        .download(plantilla.storagePath)

      if (downloadErr || !fileBlob) {
        setError('No se pudo descargar la plantilla desde Supabase Storage.')
        return
      }

      const buffer = await fileBlob.arrayBuffer()
      const datosEntrada: Record<string, string | string[]> = {}
      for (const field of plantilla.campos) {
        const raw = values[field.key] ?? emptyValueFor(field)
        datosEntrada[field.key] = Array.isArray(raw)
          ? raw.map((v) => v.trim()).filter(Boolean)
          : raw
      }

      const blob = renderEscrito(buffer, datosEntrada)
      const fecha = new Date().toISOString().slice(0, 10)
      saveAs(blob, `${plantilla.tipoEscrito}_${referencia.trim() || fecha}.docx`)

      await supabase.from('instructas_generados').insert({
        user_id: user.id,
        plantilla_id: plantilla.id,
        tipo_escrito: plantilla.tipoEscrito,
        referencia: referencia.trim() || null,
        datos_entrada: datosEntrada,
      })

      setGenerated(true)
    } catch {
      setError('No se pudo generar el escrito. Comprueba que la plantilla sigue teniendo los marcadores esperados.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-start py-10 px-6">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Generar escrito</h2>
          <p className="text-sm text-gray-400 mt-1.5">
            Rellena los datos del caso y descarga la demanda con vuestra plantilla ya redactada.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-[#2B58C4]/20 border-t-[#2B58C4] animate-spin" />
            </div>
          ) : !plantilla ? (
            <div className="flex flex-col items-center text-center py-12 px-4">
              <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-[#2B58C4]" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1.5">Aún no hay plantilla de demanda</h3>
              <p className="text-sm text-gray-400 max-w-sm mb-5">
                Sube el documento .docx de demanda del despacho en Ajustes → Escritos para poder generar escritos aquí.
              </p>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2B58C4]">
                <Settings className="w-3.5 h-3.5" /> Ajustes → Escritos
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5" /> Tipo de escrito: Demanda
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Referencia del caso (opcional)
                </label>
                <input type="text" value={referencia} onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Ej. código de expediente interno"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2B58C4]/25 focus:border-[#2B58C4] transition" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {plantilla.campos.map((field) => (
                  <div key={field.key} className={field.tipo === 'lista' || field.tipo === 'textarea' ? 'col-span-2' : ''}>
                    <DynamicField
                      field={field}
                      value={values[field.key] ?? emptyValueFor(field)}
                      onChange={(v) => setFieldValue(field.key, v)}
                    />
                  </div>
                ))}
              </div>

              {error && (
                <div role="alert" className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button onClick={handleGenerate} disabled={generating}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#2B58C4] hover:bg-[#2348A8] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#2B58C4] focus:ring-offset-2">
                  <Download className="w-4 h-4" />
                  {generating ? 'Generando…' : 'Generar y descargar'}
                </button>
                {generated && <span className="text-xs font-medium text-green-600">Escrito generado y guardado en el historial.</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
