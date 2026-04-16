import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Anthropic from 'npm:@anthropic-ai/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExtractionField {
  id: string
  key: string
  label: string
  context: string
  enabled: boolean
}

interface RequestBody {
  texts: Record<string, string>
  model: string
  system_prompt: string
  fields: ExtractionField[]
}

const SLOT_LABELS: Record<string, string> = {
  demanda:       'DEMANDA',
  contestacion:  'CONTESTACIÓN',
  emplazamiento: 'EMPLAZAMIENTO',
  otro:          'OTRO DOCUMENTO',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const body: RequestBody = await req.json()
    const { texts, model, system_prompt, fields } = body

    // ── 1. Construir el contexto con los textos de cada documento ──
    const documentBlocks = Object.entries(texts)
      .filter(([, text]) => text.trim().length > 0)
      .map(([slotId, text]) => {
        const label = SLOT_LABELS[slotId] ?? slotId.toUpperCase()
        return `### ${label}\n\n${text}`
      })

    if (documentBlocks.length === 0) {
      return new Response(JSON.stringify({ error: 'No se proporcionaron documentos con texto' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const documentContent = documentBlocks.join('\n\n---\n\n')

    // ── 2. Construir el esquema JSON con los campos habilitados ──
    const enabledFields = fields.filter((f) => f.enabled)

    if (enabledFields.length === 0) {
      return new Response(JSON.stringify({ error: 'No hay campos de extracción habilitados' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const schemaDescription = enabledFields
      .map((f) => `  "${f.key}": // ${f.label} — ${f.context}`)
      .join('\n')

    // ── 3. Mensaje de usuario ──
    const userMessage = `A continuación se proporcionan los documentos del procedimiento judicial:

${documentContent}

---

Extrae los siguientes campos y devuelve ÚNICAMENTE un objeto JSON con esta estructura:

{
${schemaDescription}
}

Devuelve solo el JSON, sin bloques de código ni texto adicional.`

    // ── 4. Llamada a Claude ──
    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
    })

    const message = await anthropic.messages.create({
      model: model || 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: system_prompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    // ── 5. Parsear la respuesta JSON ──
    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

    let cleaned = rawText.trim()
    // Eliminar bloques de código markdown si Claude los añade
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    let result: Record<string, unknown>
    try {
      result = JSON.parse(cleaned)
    } catch {
      console.error('JSON inválido recibido de Claude:', cleaned)
      return new Response(
        JSON.stringify({ error: 'La respuesta de IA no es un JSON válido', raw: cleaned }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify({ result }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Error en analyze-documents:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
