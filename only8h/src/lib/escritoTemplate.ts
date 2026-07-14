/**
 * Motor de generación de escritos (mail-merge): rellena una plantilla .docx
 * real del despacho con los datos de un caso. Sin redacción por IA — el
 * contenido jurídico es siempre el que el despacho ya escribió en su plantilla.
 */

import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

export interface TemplateField {
  key: string
  label: string
  tipo: 'texto' | 'textarea' | 'fecha' | 'numero' | 'lista'
  requerido: boolean
}

export interface EscritoTemplate {
  id: string
  user_id: string
  tipo_escrito: string
  nombre: string
  storage_path: string
  campos: TemplateField[]
  created_at: string
}

export interface DetectedTag {
  key: string
  /** true si el marcador es un bloque de lista `{#key}...{/key}` */
  isList: boolean
}

/**
 * Detecta los marcadores de una plantilla .docx sin necesidad de rellenarla.
 * Lee el texto plano de `word/document.xml` (solo el cuerpo, no cabeceras ni
 * pies de página) y busca marcadores `{campo}` y bloques de lista
 * `{#campo}...{/campo}`.
 *
 * Limitación conocida: solo se soportan bloques de lista de valores planos
 * (`{#hechos}{.}{/hechos}`), no listas de objetos anidados. Si Word divide un
 * marcador entre varias "runs" de texto (por autocorrección o cambios de
 * formato a media palabra), no se detectará — hay que escribir el marcador
 * de un tirón, sin autocorrección.
 */
export function extractTemplateTags(buffer: ArrayBuffer): DetectedTag[] {
  const zip = new PizZip(buffer)
  const documentXml = zip.file('word/document.xml')
  if (!documentXml) {
    throw new Error('El archivo no es un .docx válido (falta word/document.xml)')
  }

  const plainText = documentXml.asText().replace(/<[^>]+>/g, '')

  const listKeys = new Set<string>()
  const simpleKeys = new Set<string>()

  const tagPattern = /\{([#^/]?)([^{}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = tagPattern.exec(plainText)) !== null) {
    const [, prefix, rawKey] = match
    const key = rawKey.trim()
    if (!key || key === '.') continue

    if (prefix === '#' || prefix === '^') listKeys.add(key)
    else if (prefix === '') simpleKeys.add(key)
    // prefix === '/' (cierre de bloque) se ignora
  }

  for (const key of listKeys) simpleKeys.delete(key)

  return [
    ...Array.from(listKeys).map((key) => ({ key, isList: true })),
    ...Array.from(simpleKeys).map((key) => ({ key, isList: false })),
  ]
}

/**
 * Sustituye los marcadores de la plantilla por los datos del caso y devuelve
 * el .docx final listo para descargar.
 */
export function renderEscrito(buffer: ArrayBuffer, data: Record<string, string | string[]>): Blob {
  const zip = new PizZip(buffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  })

  doc.render(data)

  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}
