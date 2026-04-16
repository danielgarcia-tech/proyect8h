/**
 * Llama a Claude con los textos de los documentos, el prompt y los campos
 * de extracción configurados por el usuario.
 *
 * MODO TESTING: llama directamente a Anthropic desde el navegador.
 * En producción, sustituir por supabase.functions.invoke('analyze-documents').
 */

import Anthropic from '@anthropic-ai/sdk'
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

const SLOT_LABELS: Record<string, string> = {
  demanda:       'DEMANDA',
  contestacion:  'CONTESTACIÓN',
  emplazamiento: 'EMPLAZAMIENTO',
  otro:          'OTRO DOCUMENTO',
}

export async function callAI(params: AICallParams): Promise<AnalysisResult> {
  const { texts, model, system_prompt, fields } = params

  // ── 1. Construir bloques de documentos ──
  const documentBlocks = Object.entries(texts)
    .filter(([, text]) => text.trim().length > 0)
    .map(([slotId, text]) => {
      const label = SLOT_LABELS[slotId] ?? slotId.toUpperCase()
      return `### ${label}\n\n${text}`
    })

  if (documentBlocks.length === 0) {
    throw new Error('No se encontró texto en los documentos proporcionados')
  }

  // ── 2. Construir esquema JSON con los campos habilitados ──
  const enabledFields = fields.filter((f) => f.enabled)
  if (enabledFields.length === 0) {
    throw new Error('No hay campos de extracción habilitados en la configuración')
  }

  const schemaDescription = enabledFields
    .map((f) => `  "${f.key}": // ${f.label} — ${f.context}`)
    .join('\n')

  const userMessage = `A continuación se proporcionan los documentos del procedimiento judicial:

${documentBlocks.join('\n\n---\n\n')}

---

Extrae los siguientes campos y devuelve ÚNICAMENTE un objeto JSON con esta estructura:

{
${schemaDescription}
}

Devuelve solo el JSON, sin bloques de código ni texto adicional.`

  // ── 3. Llamar a Claude ──
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string
  if (!apiKey) throw new Error('Falta VITE_ANTHROPIC_API_KEY en el entorno')

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  })

  const message = await client.messages.create({
    model: model || 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: system_prompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  // ── 4. Parsear respuesta JSON ──
  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
  let cleaned = rawText.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  let result: AnalysisResult
  try {
    result = JSON.parse(cleaned)
  } catch {
    throw new Error(`La IA devolvió una respuesta que no es JSON válido:\n${cleaned.slice(0, 200)}`)
  }

  return result
}
