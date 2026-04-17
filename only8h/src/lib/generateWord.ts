import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from 'docx'
import { saveAs } from 'file-saver'
import type { ExtractionField, ExcepcionConfig, ReportConfig, ReportSection } from './generatePdf'
import { DEFAULT_FIELD_SECTIONS, SPECIAL_LIST_KEYS } from './generatePdf'

// ── Helpers ────────────────────────────────────────────────────────────────
function isoToEs(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](.+))?$/)
  if (!m) return s
  return m[4] ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}` : `${m[3]}-${m[2]}-${m[1]}`
}

function formatVal(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (Array.isArray(val)) return val.map(String).join('\n')
  if (typeof val === 'number') return val.toLocaleString('es-ES')
  return isoToEs(String(val))
}

function isArr(val: unknown): val is string[] {
  return Array.isArray(val) && val.length > 0
}

function hex(color: string): string {
  return color.replace('#', '')
}

function secEnabled(id: string, sections?: ReportSection[]): boolean {
  if (!sections?.length) return true
  const s = sections.find((x) => x.id === id)
  return s ? s.enabled : true
}

function secTitle(id: string, fallback: string, sections?: ReportSection[]): string {
  return sections?.find((x) => x.id === id)?.title ?? fallback
}

// ── Constructores de celda ─────────────────────────────────────────────────
function labelCell(text: string, primary: string, secondary: string): TableCell {
  return new TableCell({
    width: { size: 36, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: hex(secondary) },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
      left:   { style: BorderStyle.NONE },
      right:  { style: BorderStyle.NONE },
    },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, color: hex(primary), size: 18 })],
    })],
  })
}

function valueCell(text: string, overrideBg?: string): TableCell {
  return new TableCell({
    width: { size: 64, type: WidthType.PERCENTAGE },
    shading: overrideBg ? { type: ShadingType.SOLID, color: overrideBg } : undefined,
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
      left:   { style: BorderStyle.NONE },
      right:  { style: BorderStyle.NONE },
    },
    children: [new Paragraph({
      children: [new TextRun({
        text,
        color: overrideBg ? 'FFFFFF' : '374151',
        bold: !!overrideBg,
        size: 18,
      })],
    })],
  })
}

function makeTable(
  rows: [string, string][],
  title: string,
  primary: string,
  secondary: string,
): (Paragraph | Table)[] {
  if (!rows.length) return []
  return [
    new Paragraph({
      spacing: { before: 320, after: 120 },
      children: [new TextRun({ text: title.toUpperCase(), bold: true, color: hex(primary), size: 20 })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map(([label, value]) =>
        new TableRow({ children: [labelCell(label, primary, secondary), valueCell(value)] }),
      ),
    }),
  ]
}

// ── Tabla especial para calendario con badges de color ────────────────────
function badgeColor(key: string, val: string): string | undefined {
  if (key === 'tipo_vista') {
    if (val === 'TELEMATICA' || val === 'TELEMÁTICA') return '2563EB'
    if (val === 'PRESENCIAL') return '16A34A'
  }
  if (key === 'inicio_acto') {
    if (val === 'AUDIENCIA PREVIA' || val === 'AUDIENCIA_PREVIA') return 'EA580C'
    if (val === 'JUICIO') return 'B91C1C'
  }
  return undefined
}

function makeCalendario(
  rows: [string, string, string][],  // [label, key, rawVal]
  title: string,
  primary: string,
  secondary: string,
): (Paragraph | Table)[] {
  if (!rows.length) return []
  return [
    new Paragraph({
      spacing: { before: 320, after: 120 },
      children: [new TextRun({ text: title.toUpperCase(), bold: true, color: hex(primary), size: 20 })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map(([label, key, rawVal]) => {
        const displayVal = key === 'inicio_acto' ? rawVal.replace('_', ' ') : rawVal
        const bg = badgeColor(key, displayVal)
        return new TableRow({
          children: [labelCell(label, primary, secondary), valueCell(displayVal, bg)],
        })
      }),
    }),
  ]
}

// ── Lista numerada ─────────────────────────────────────────────────────────
function makeList(items: string[], title: string, color: string): Paragraph[] {
  if (!items.length) return []
  return [
    new Paragraph({
      spacing: { before: 320, after: 120 },
      children: [new TextRun({ text: title.toUpperCase(), bold: true, color: hex(color), size: 20 })],
    }),
    ...items.map((item, i) =>
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: `${i + 1}.  `, bold: true, color: hex(color), size: 18 }),
          new TextRun({ text: item, color: '374151', size: 18 }),
        ],
      }),
    ),
  ]
}

// ── Timeline ──────────────────────────────────────────────────────────────
interface TimelineEvent {
  date: string
  label: string
  detail?: string
}

function buildTimelineEventsWord(
  resultado: Record<string, unknown>,
  fields: ExtractionField[],
): TimelineEvent[] {
  const events: Array<TimelineEvent & { rawDate: string }> = []
  const coveredKeys = new Set(['inicio_acto', 'tipo_vista', ...SPECIAL_LIST_KEYS])

  const knownDates: Array<{ key: string; getDetail?: () => string | undefined }> = [
    { key: 'fecha_presentacion' },
    {
      key: 'dia_vista',
      getDetail: () => {
        const parts: string[] = []
        const ia = resultado['inicio_acto']
        const tv = resultado['tipo_vista']
        if (ia) parts.push(String(ia).replace('_', ' '))
        if (tv) parts.push(String(tv))
        const v = String(resultado['dia_vista'] ?? '')
        const timeMatch = v.match(/[T ](\d{2}:\d{2})/)
        if (timeMatch) parts.push(timeMatch[1] + 'h')
        return parts.length ? parts.join(' · ') : undefined
      },
    },
  ]

  for (const { key, getDetail } of knownDates) {
    coveredKeys.add(key)
    const val = resultado[key]
    if (!val || typeof val !== 'string') continue
    const dateMatch = val.match(/^(\d{4}-\d{2}-\d{2})/)
    if (!dateMatch) continue
    const field = fields.find((f) => f.key === key)
    events.push({
      rawDate: dateMatch[1],
      date: isoToEs(dateMatch[1]),
      label: field?.label ?? key,
      detail: getDetail?.(),
    })
  }

  // Auto-detect other ISO date fields
  for (const [key, val] of Object.entries(resultado)) {
    if (coveredKeys.has(key) || typeof val !== 'string') continue
    const dateMatch = val.match(/^(\d{4}-\d{2}-\d{2})/)
    if (!dateMatch) continue
    const field = fields.find((f) => f.key === key)
    events.push({ rawDate: dateMatch[1], date: isoToEs(dateMatch[1]), label: field?.label ?? key })
  }

  events.sort((a, b) => a.rawDate.localeCompare(b.rawDate))
  return events.map(({ rawDate: _r, ...rest }) => rest)
}

function makeTimeline(
  events: TimelineEvent[],
  title: string,
  primary: string,
  secondary: string,
): (Paragraph | Table)[] {
  if (!events.length) return []

  const elements: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { before: 320, after: 120 },
      children: [new TextRun({ text: title.toUpperCase(), bold: true, color: hex(primary), size: 20 })],
    }),
  ]

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top:           { style: BorderStyle.NONE },
        bottom:        { style: BorderStyle.NONE },
        left:          { style: BorderStyle.NONE },
        right:         { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical:   { style: BorderStyle.NONE },
      },
      rows: events.map((ev, i) => {
        const isLast = i === events.length - 1
        return new TableRow({
          children: [
            // Columna de línea + dot
            new TableCell({
              width: { size: 6, type: WidthType.PERCENTAGE },
              borders: {
                top:    { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: {
                  style: i === 0 ? BorderStyle.NONE : BorderStyle.SINGLE,
                  size: 4, color: hex(primary),
                },
                right:  { style: BorderStyle.NONE },
              },
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({
                  text: isLast ? '◉' : '●',
                  color: hex(primary),
                  bold: true,
                  size: 16,
                })],
              })],
            }),
            // Columna de fecha
            new TableCell({
              width: { size: 22, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.SOLID, color: hex(secondary) },
              borders: {
                top:    { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left:   { style: BorderStyle.NONE },
                right:  { style: BorderStyle.NONE },
              },
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: ev.date, bold: true, color: hex(primary), size: 18 })],
              })],
            }),
            // Columna de contenido
            new TableCell({
              width: { size: 72, type: WidthType.PERCENTAGE },
              borders: {
                top:    { style: BorderStyle.NONE },
                bottom: { style: isLast ? BorderStyle.NONE : BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
                left:   { style: BorderStyle.NONE },
                right:  { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  spacing: { after: ev.detail ? 40 : 80 },
                  children: [new TextRun({ text: ev.label, bold: true, color: '1F2937', size: 18 })],
                }),
                ...(ev.detail ? [
                  new Paragraph({
                    spacing: { after: 80 },
                    children: [new TextRun({ text: ev.detail, color: '6B7280', size: 16, italics: true })],
                  }),
                ] : []),
              ],
            }),
          ],
        })
      }),
    }),
  )

  return elements
}

// ── Tabla de 2 columnas (portada) ──────────────────────────────────────────
function makeTwoColumnPortada(
  procRows: [string, string][],
  partesRows: [string, string][],
  procTitle: string,
  partesTitle: string,
  primary: string,
  secondary: string,
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = []

  if (procRows.length) {
    elements.push(
      new Paragraph({
        spacing: { before: 240, after: 80 },
        children: [new TextRun({ text: procTitle.toUpperCase(), bold: true, color: hex(primary), size: 19 })],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: procRows.map(([label, value]) =>
          new TableRow({ children: [labelCell(label, primary, secondary), valueCell(value)] }),
        ),
      }),
    )
  }

  if (partesRows.length) {
    elements.push(
      new Paragraph({
        spacing: { before: 280, after: 80 },
        children: [new TextRun({ text: partesTitle.toUpperCase(), bold: true, color: hex(primary), size: 19 })],
      }),
    )

    // Tabla 2x2 para partes (demandante/demandado + procurador/abogado)
    const dem = partesRows.find(([l]) => l.toLowerCase().includes('demandante'))
    const ddo = partesRows.find(([l]) => l.toLowerCase().includes('demandado'))
    const pro = partesRows.find(([l]) => l.toLowerCase().includes('procurador'))
    const abo = partesRows.find(([l]) => l.toLowerCase().includes('abogado'))

    const remaining = partesRows.filter(
      ([l]) => !['demandante', 'demandado', 'procurador', 'abogado'].some((k) => l.toLowerCase().includes(k)),
    )

    const makeHalfCell = (label: string, value: string, isPrimary: boolean): TableCell =>
      new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: isPrimary ? hex(primary) : 'F1F5F9' },
        borders: {
          top:    { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
          left:   { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
          right:  { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
        },
        children: [
          new Paragraph({
            spacing: { after: 20 },
            children: [new TextRun({
              text: label,
              bold: true,
              color: isPrimary ? 'FFFFFF' : hex(primary),
              size: 15,
            })],
          }),
          new Paragraph({
            children: [new TextRun({ text: value, color: isPrimary ? 'E0E7FF' : '374151', size: 18 })],
          }),
        ],
      })

    if (dem || ddo) {
      elements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              makeHalfCell(dem?.[0] ?? 'Demandante', dem?.[1] ?? '—', true),
              makeHalfCell(ddo?.[0] ?? 'Demandado', ddo?.[1] ?? '—', false),
            ],
          }),
          ...(pro || abo ? [
            new TableRow({
              children: [
                makeHalfCell(pro?.[0] ?? 'Procurador', pro?.[1] ?? '—', false),
                makeHalfCell(abo?.[0] ?? 'Abogado', abo?.[1] ?? '—', false),
              ],
            }),
          ] : []),
        ],
      }))
    }

    if (remaining.length) {
      elements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: remaining.map(([label, value]) =>
          new TableRow({ children: [labelCell(label, primary, secondary), valueCell(value)] }),
        ),
      }))
    }
  }

  return elements
}

// ── Divisor ────────────────────────────────────────────────────────────────
const divider = new Paragraph({ spacing: { before: 200, after: 200 }, children: [new TextRun({ text: '' })] })

// ── Generador principal ────────────────────────────────────────────────────
export async function generateWord(
  resultado: Record<string, unknown>,
  fields: ExtractionField[],
  codigoAranzadi: string,
  firmName = '',
  excepcionesConfig: ExcepcionConfig[] = [],
  reportConfig?: ReportConfig,
): Promise<void> {
  const primary   = reportConfig?.primary_color   ?? '#2B58C4'
  const secondary = reportConfig?.secondary_color ?? '#F8FAFC'
  const footerTxt = reportConfig?.footer_text || 'Documento generado automaticamente por ONLY8H · Confidencial'
  const firm      = reportConfig?.firm_name || firmName || 'ONLY8H — Informe juridico'
  const sections  = reportConfig?.sections
  const fs        = reportConfig?.field_sections ?? DEFAULT_FIELD_SECTIONS

  const fieldMap = Object.fromEntries(fields.map((f) => [f.key, f.label]))

  // ── Datos por sección ────────────────────────────────────────────────
  const procRows: [string, string][] = fs.procedimiento
    .filter((k) => resultado[k] != null)
    .map((k) => [fieldMap[k] ?? k, formatVal(resultado[k])])

  const partesRows: [string, string][] = fs.partes
    .filter((k) => resultado[k] != null)
    .map((k) => [fieldMap[k] ?? k, formatVal(resultado[k])])

  const calRows: [string, string, string][] = fs.calendario
    .filter((k) => resultado[k] != null)
    .map((k) => [fieldMap[k] ?? k, k, String(resultado[k])])

  const acciones: string[] = isArr(resultado['acciones_ejercitadas'])
    ? resultado['acciones_ejercitadas']
    : resultado['acciones_ejercitadas'] ? [formatVal(resultado['acciones_ejercitadas'])] : []

  const excepciones: string[] = isArr(resultado['excepciones_procesales'])
    ? resultado['excepciones_procesales']
    : []

  const hechos: string[] = isArr(resultado['hechos_controvertidos'])
    ? resultado['hechos_controvertidos']
    : []

  // Datos extras (no mostrados en otras secciones)
  const alreadyShown = new Set([
    ...fs.procedimiento, ...fs.partes, ...fs.calendario, ...SPECIAL_LIST_KEYS,
  ])
  const extraRows: [string, string][] = Object.entries(resultado)
    .filter(([k, v]) => !alreadyShown.has(k) && v != null)
    .map(([k, v]) => [fieldMap[k] ?? k, formatVal(v)])

  let n = 0
  const num = () => { n += 1; return n }

  // ── Cabecera del documento ────────────────────────────────────────────
  const body: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: firm.toUpperCase(), bold: true, color: hex(primary), size: 34 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: 'INFORME JURIDICO', bold: true, color: hex(primary), size: 22 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: `Ref.: ${codigoAranzadi}`, color: '374151', size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
      children: [new TextRun({
        text: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
        color: '9CA3AF',
        size: 18,
      })],
    }),
  ]

  // ── §1: Portada (proc + partes en layout visual) ──────────────────────
  if (secEnabled('portada', sections)) {
    const pTitle = secTitle('portada', 'Datos del procedimiento', sections)
    body.push(...makeTwoColumnPortada(
      procRows, partesRows,
      `${num()}. ${pTitle}`,
      'Partes intervinientes',
      primary, secondary,
    ))
    body.push(divider)
  }

  // ── §2: Timeline del asunto ───────────────────────────────────────────
  if (secEnabled('timeline', sections)) {
    const events = buildTimelineEventsWord(resultado, fields)
    if (events.length) {
      body.push(...makeTimeline(events, `${num()}. ${secTitle('timeline', 'Cronologia del asunto', sections)}`, primary, secondary))
      body.push(divider)
    }
  }

  // ── §3: Calendario / Vista procesal ───────────────────────────────────
  if (secEnabled('calendario', sections) && calRows.length) {
    body.push(...makeCalendario(calRows, `${num()}. ${secTitle('calendario', 'Vista procesal', sections)}`, primary, secondary))
    body.push(divider)
  }

  // ── §4: Acciones ejercitadas ──────────────────────────────────────────
  if (secEnabled('acciones', sections) && acciones.length) {
    body.push(...makeList(acciones, `${num()}. ${secTitle('acciones', 'Acciones ejercitadas', sections)}`, '#059669'))
    body.push(divider)
  }

  // ── §5: Excepciones procesales ────────────────────────────────────────
  if (secEnabled('excepciones', sections)) {
    const excTitle = `${num()}. ${secTitle('excepciones', 'Excepcion procesal', sections)}`.toUpperCase()
    if (excepciones.length) {
      body.push(new Paragraph({
        spacing: { before: 320, after: 120 },
        children: [new TextRun({ text: excTitle, bold: true, color: 'DC2626', size: 20 })],
      }))
      body.push(...excepciones.flatMap((item, i) => {
        const match = excepcionesConfig.find(
          (ec) => ec.nombre.trim().toLowerCase() === item.trim().toLowerCase()
            || item.trim().toLowerCase().includes(ec.nombre.trim().toLowerCase()),
        )
        const rows: Paragraph[] = [
          new Paragraph({
            shading: { type: ShadingType.SOLID, color: 'FEE2E2' },
            spacing: { after: match?.texto_asociado ? 40 : 100 },
            children: [
              new TextRun({ text: `${i + 1}.  `, bold: true, color: 'DC2626', size: 18 }),
              new TextRun({ text: item, bold: true, color: '374151', size: 18 }),
            ],
          }),
        ]
        if (match?.texto_asociado) {
          rows.push(new Paragraph({
            spacing: { after: 100 },
            indent: { left: 360 },
            shading: { type: ShadingType.SOLID, color: 'FFF5F5' },
            children: [new TextRun({ text: match.texto_asociado, color: '4B5563', size: 17, italics: true })],
          }))
        }
        return rows
      }))
    } else {
      body.push(
        new Paragraph({
          spacing: { before: 320, after: 80 },
          children: [new TextRun({ text: excTitle, bold: true, color: 'DC2626', size: 20 })],
        }),
        new Paragraph({
          children: [new TextRun({ text: 'No se han alegado excepciones procesales.', color: '16A34A', size: 18, italics: true })],
        }),
      )
    }
    body.push(divider)
  }

  // ── §6: Hechos controvertidos ─────────────────────────────────────────
  if (secEnabled('hechos', sections) && hechos.length) {
    body.push(...makeList(hechos, `${num()}. ${secTitle('hechos', 'Hechos controvertidos', sections)}`, '#0891B2'))
    body.push(divider)
  }

  // ── §7: Datos adicionales (no mostrados en otras secciones) ──────────
  if (secEnabled('datos', sections) && extraRows.length) {
    body.push(...makeTable(extraRows, `${num()}. ${secTitle('datos', 'Datos adicionales', sections)}`, primary, secondary))
  }

  // ── Documento ─────────────────────────────────────────────────────────
  const doc = new Document({
    numbering: { config: [] },
    sections: [{
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: firm, color: '9CA3AF', size: 16 })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `${footerTxt}  ·  Pag. `, color: '9CA3AF', size: 16 }),
              new TextRun({ children: [PageNumber.CURRENT], color: '9CA3AF', size: 16 }),
              new TextRun({ text: ' / ', color: '9CA3AF', size: 16 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], color: '9CA3AF', size: 16 }),
            ],
          })],
        }),
      },
      properties: {
        page: {
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      children: body,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const date = new Date().toISOString().slice(0, 10)
  saveAs(blob, `informe_${codigoAranzadi}_${date}.docx`)
}
