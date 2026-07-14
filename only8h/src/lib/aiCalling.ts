/**
 * Llama a Claude con los textos de los documentos, el prompt y los campos
 * de extracción configurados por el usuario, a través de la Edge Function
 * `analyze-documents` (la API key de Anthropic vive solo en el servidor).
 */

import { supabase } from './supabase'
import type { ExtractionField, AnalysisResult } from './generatePdf'

export interface AICallParams {
  /** Textos extraídos de cada documento, indexados por slotId */
  texts: Record<string, string>
  /** ID del modelo Claude (ej. 'claude-sonnet-4-6') */
  model: string
  /** System prompt personalizado */
  system_prompt: string
  /** Campos de extracción configurados por el usuario */
  fields: ExtractionField[]
}

export async function callAI(params: AICallParams): Promise<AnalysisResult> {
  const { texts, fields } = params

  // ── Validación rápida en cliente (evita un viaje de red innecesario) ──
  const hasText = Object.values(texts).some((text) => text.trim().length > 0)
  if (!hasText) {
    throw new Error('No se encontró texto en los documentos proporcionados')
  }
  if (!fields.some((f) => f.enabled)) {
    throw new Error('No hay campos de extracción habilitados en la configuración')
  }

  // ── Llamar a la Edge Function (la API key de Anthropic vive en el servidor) ──
  const { data, error } = await supabase.functions.invoke('analyze-documents', {
    body: params,
  })

  if (error) {
    const context = (error as { context?: Response }).context
    const body = context ? await context.json().catch(() => null) : null
    throw new Error(body?.error ?? error.message ?? 'Error llamando al servicio de análisis IA')
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return data.result as AnalysisResult
}
