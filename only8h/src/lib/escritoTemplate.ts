/**
 * Motor de generación de escritos (mail-merge): rellena una plantilla .docx
 * real del despacho con los datos de un caso. Sin redacción por IA — el
 * contenido jurídico es siempre el que el despacho ya escribió en su plantilla.
 *
 * Soporta dos estilos de marcador de hueco:
 *  - `curly`:   {campo}            (plantillas creadas desde esta web)
 *  - `bracket`: [CAMPO DESCRIPTIVO] (plantillas convertidas por litigación
 *               desde escritos reales, con los huecos subrayados en Word)
 */

import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

export type DelimiterStyle = 'curly' | 'bracket'

export const DELIMITER_SETS: Record<DelimiterStyle, { start: string; end: string }> = {
  curly: { start: '{', end: '}' },
  bracket: { start: '[', end: ']' },
}

export interface TemplateField {
  key: string
  /**
   * Texto exacto entre delimitadores en el .docx (p. ej. "Nº PROCEDIMIENTO").
   * Ausente en filas `curly` creadas antes de este cambio — en ese caso
   * `key` ya es el texto literal del tag y sirve de fallback.
   */
  rawTag?: string
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
}

export interface DetectedTag {
  key: string
  /** Texto exacto entre delimitadores, tal cual aparece en la plantilla. */
  rawTag: string
  /** true si el marcador es un bloque de lista `{#key}...{/key}` / `[#KEY]...[/KEY]` */
  isList: boolean
}

/**
 * Convierte una etiqueta descriptiva en una clave estable para BD/JSON/React.
 * NFKD (no NFD) es necesario porque `º`/`ª` tienen descomposición de
 * compatibilidad directa a "o"/"a" sin marca combinante, a diferencia de las
 * vocales acentuadas normales.
 */
const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

export function slugify(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(COMBINING_DIACRITICS, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  ) || 'campo'
}

/**
 * Slugifica una lista de etiquetas y renombra los duplicados añadiendo un
 * sufijo `_2`, `_3`... por orden de aparición, para que dos huecos distintos
 * que colisionen al slugificar (p. ej. por puntuación) no se pisen entre sí.
 */
function dedupeSlugs<T extends { rawTag: string }>(
  items: T[],
): (T & { key: string })[] {
  const seen = new Map<string, number>()
  return items.map((item) => {
    const base = slugify(item.rawTag)
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    const key = count === 0 ? base : `${base}_${count + 1}`
    return { ...item, key }
  })
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractRawTags(
  plainText: string,
  delims: { start: string; end: string },
): { rawTag: string; isList: boolean }[] {
  const excludedChars = `${delims.start}${delims.end}`
  const excludedClass = excludedChars.replace(/[\]\\^-]/g, '\\$&')
  const pattern = new RegExp(
    `${escapeRegExp(delims.start)}([#^/]?)([^${excludedClass}]+)${escapeRegExp(delims.end)}`,
    'g',
  )

  const listKeys = new Set<string>()
  const simpleKeys = new Set<string>()

  let match: RegExpExecArray | null
  while ((match = pattern.exec(plainText)) !== null) {
    const [, prefix, rawKey] = match
    const key = rawKey.trim()
    if (!key || key === '.') continue

    if (prefix === '#' || prefix === '^') listKeys.add(key)
    else if (prefix === '') simpleKeys.add(key)
    // prefix === '/' (cierre de bloque) se ignora
  }

  for (const key of listKeys) simpleKeys.delete(key)

  return [
    ...Array.from(listKeys).map((rawTag) => ({ rawTag, isList: true })),
    ...Array.from(simpleKeys).map((rawTag) => ({ rawTag, isList: false })),
  ]
}

function readPlainText(buffer: ArrayBuffer): string {
  const zip = new PizZip(buffer)
  const documentXml = zip.file('word/document.xml')
  if (!documentXml) {
    throw new Error('El archivo no es un .docx válido (falta word/document.xml)')
  }
  return documentXml.asText().replace(/<[^>]+>/g, '')
}

/**
 * Detecta los marcadores de una plantilla .docx sin necesidad de rellenarla,
 * probando primero el estilo `{campo}` y, si no encuentra ninguno, el estilo
 * `[CAMPO]` usado por las plantillas convertidas por litigación.
 *
 * Limitación conocida: solo se leen los marcadores del cuerpo del documento
 * (`word/document.xml`), no cabeceras ni pies de página. Si Word divide un
 * marcador entre varias "runs" de texto (por autocorrección o cambios de
 * formato a media palabra), no se detectará — hay que escribir el marcador
 * de un tirón, sin autocorrección.
 */
export function detectTemplateTags(
  buffer: ArrayBuffer,
): { style: DelimiterStyle; tags: DetectedTag[] } {
  const plainText = readPlainText(buffer)

  for (const style of ['curly', 'bracket'] as const) {
    const raw = extractRawTags(plainText, DELIMITER_SETS[style])
    if (raw.length > 0) {
      return { style, tags: dedupeSlugs(raw) }
    }
  }

  return { style: 'curly', tags: [] }
}

/**
 * Sustituye los marcadores de la plantilla por los datos del caso y devuelve
 * el .docx final listo para descargar. `data` debe estar indexado por el
 * texto literal del marcador (`rawTag`), no por el slug (`key`).
 */
export function renderEscrito(
  buffer: ArrayBuffer,
  data: Record<string, string | string[]>,
  delimiters: { start: string; end: string } = DELIMITER_SETS.curly,
): Blob {
  const zip = new PizZip(buffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
    delimiters,
  })

  doc.render(data)

  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}
