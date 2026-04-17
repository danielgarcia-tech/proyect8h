import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Tipos ──────────────────────────────────────────────────────────────────
export interface ExtractionField {
  id: string
  key: string
  label: string
  context: string
  enabled: boolean
}

export interface ReportSection {
  id: string
  title: string
  subtitle: string
  enabled: boolean
}

export interface FieldSections {
  procedimiento: string[]
  partes: string[]
  calendario: string[]
}

export const DEFAULT_FIELD_SECTIONS: FieldSections = {
  procedimiento: ['NIG', 'procedimiento', 'juzgado', 'numero_autos', 'cuantia', 'fecha_presentacion'],
  partes:        ['demandante', 'demandado', 'procurador', 'abogado'],
  calendario:    ['dia_vista', 'tipo_vista', 'inicio_acto', 'telefono_incidencias'],
}

export const SPECIAL_LIST_KEYS = new Set([
  'acciones_ejercitadas',
  'excepciones_procesales',
  'hechos_controvertidos',
])

export interface ReportConfig {
  firm_name: string
  firm_tagline: string
  firm_address: string
  firm_phone: string
  firm_email: string
  firm_web: string
  footer_text: string
  primary_color: string
  secondary_color: string
  font_size: string
  sections: ReportSection[]
  field_sections?: FieldSections | null
}

export type AnalysisResult = Record<string, unknown>

export interface ExcepcionConfig {
  id: string
  nombre: string
  texto_asociado: string
}

// ── Helpers ────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const n = parseInt(clean, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function isoToEs(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](.+))?$/)
  if (!m) return s
  return m[4] ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}` : `${m[3]}-${m[2]}-${m[1]}`
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (Array.isArray(val)) return val.map((v, i) => `${i + 1}. ${v}`).join('\n')
  if (typeof val === 'number') return val.toLocaleString('es-ES')
  const s = String(val)
  return isoToEs(s)
}

function formatBadgeValue(key: string, val: unknown): string {
  const s = String(val ?? '')
  if (key === 'inicio_acto') return s.replace('_', ' ')
  return s
}

function baseFontSize(size: string): number {
  if (size === 'small') return 9
  if (size === 'large') return 11
  return 10
}

// ── Timeline events ────────────────────────────────────────────────────────
interface TimelineEvent {
  rawDate: string
  date: string
  label: string
  detail?: string
}

function buildTimelineEvents(
  result: AnalysisResult,
  fields: ExtractionField[],
): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const coveredKeys = new Set(['inicio_acto', 'tipo_vista', ...SPECIAL_LIST_KEYS])

  // Known date fields with special handling
  const knownDates: Array<{ key: string; getDetail?: () => string | undefined }> = [
    { key: 'fecha_presentacion' },
    {
      key: 'dia_vista',
      getDetail: () => {
        const parts: string[] = []
        const ia = result['inicio_acto']
        const tv = result['tipo_vista']
        if (ia) parts.push(String(ia).replace('_', ' '))
        if (tv) parts.push(String(tv))
        const v = String(result['dia_vista'] ?? '')
        const timeMatch = v.match(/[T ](\d{2}:\d{2})/)
        if (timeMatch) parts.push(timeMatch[1] + 'h')
        return parts.length ? parts.join(' · ') : undefined
      },
    },
  ]

  for (const { key, getDetail } of knownDates) {
    coveredKeys.add(key)
    const val = result[key]
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
  for (const [key, val] of Object.entries(result)) {
    if (coveredKeys.has(key) || typeof val !== 'string') continue
    const dateMatch = val.match(/^(\d{4}-\d{2}-\d{2})/)
    if (!dateMatch) continue
    const field = fields.find((f) => f.key === key)
    events.push({ rawDate: dateMatch[1], date: isoToEs(dateMatch[1]), label: field?.label ?? key })
  }

  events.sort((a, b) => a.rawDate.localeCompare(b.rawDate))
  return events
}

// ── Generador principal ─────────────────────────────────────────────────────
export function generatePdf(
  result: AnalysisResult,
  fields: ExtractionField[],
  config: ReportConfig,
  excepcionesConfig: ExcepcionConfig[] = [],
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 15
  const contentW = pageW - marginX * 2
  const [pr, pg, pb] = hexToRgb(config.primary_color)
  const [sr, sg, sb] = hexToRgb(config.secondary_color)
  const base = baseFontSize(config.font_size)
  const midX = pageW / 2

  let y = 0

  // ── Pie de página ──────────────────────────────────────────────────────
  function addFooter(pageNum: number) {
    const total = doc.getNumberOfPages()
    doc.setPage(pageNum)
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 160)
    const footer = config.footer_text || 'Documento generado automáticamente por ONLY8H · Confidencial'
    doc.text(footer, marginX, pageH - 8)
    doc.text(`Pag. ${pageNum} / ${total}`, pageW - marginX, pageH - 8, { align: 'right' })
    doc.setDrawColor(220, 220, 220)
    doc.line(marginX, pageH - 11, pageW - marginX, pageH - 11)
  }

  // ── CABECERA ──────────────────────────────────────────────────────────
  doc.setFillColor(pr, pg, pb)
  doc.rect(0, 0, pageW, 36, 'F')

  // Acento lateral izquierdo
  doc.setFillColor(255, 255, 255)
  doc.setGState(new (doc as any).GState({ opacity: 0.15 }))
  doc.rect(0, 0, 4, 36, 'F')
  doc.setGState(new (doc as any).GState({ opacity: 1 }))

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(base + 7)
  doc.setTextColor(255, 255, 255)
  doc.text(config.firm_name || 'Despacho Juridico', marginX, 14)

  if (config.firm_tagline) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(base - 1)
    doc.setGState(new (doc as any).GState({ opacity: 0.75 }))
    doc.text(config.firm_tagline, marginX, 20)
    doc.setGState(new (doc as any).GState({ opacity: 1 }))
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(base)
  doc.setTextColor(255, 255, 255)
  doc.text('INFORME JURIDICO', pageW - marginX, 12, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(base - 1)
  doc.text(
    new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
    pageW - marginX, 19, { align: 'right' },
  )

  // Franja de contacto
  doc.setFillColor(sr, sg, sb)
  doc.rect(0, 36, pageW, 11, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(80, 80, 100)
  const contacts: string[] = []
  if (config.firm_address) contacts.push(config.firm_address)
  if (config.firm_phone)   contacts.push(`Tel. ${config.firm_phone}`)
  if (config.firm_email)   contacts.push(config.firm_email)
  if (config.firm_web)     contacts.push(config.firm_web)
  if (contacts.length) doc.text(contacts.join('   |   '), marginX, 43)

  // Línea separadora
  doc.setDrawColor(pr, pg, pb)
  doc.setLineWidth(0.8)
  doc.line(0, 47, pageW, 47)

  y = 56

  // ── SECCIONES ────────────────────────────────────────────────────────
  const enabledSections = config.sections.filter((s) => s.enabled)

  function sectionTitle(title: string) {
    if (y > pageH - 35) { doc.addPage(); y = 20 }
    doc.setFillColor(pr, pg, pb)
    doc.rect(marginX, y - 4, contentW, 7, 'F')
    // Acento izquierdo en la sección
    doc.setFillColor(255, 255, 255)
    doc.setGState(new (doc as any).GState({ opacity: 0.25 }))
    doc.rect(marginX, y - 4, 3, 7, 'F')
    doc.setGState(new (doc as any).GState({ opacity: 1 }))
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(base - 0.5)
    doc.setTextColor(255, 255, 255)
    doc.text(title.toUpperCase(), marginX + 6, y + 0.5)
    y += 9
  }

  function ensurePage(needed: number) {
    if (y + needed > pageH - 18) { doc.addPage(); y = 20 }
  }

  for (const sec of enabledSections) {
    switch (sec.id) {

      // ── Portada: 2 columnas (procedimiento | partes) ─────────────────
      case 'portada': {
        sectionTitle(sec.title)
        const fs = config.field_sections ?? DEFAULT_FIELD_SECTIONS

        const procRows = fs.procedimiento
          .map((k) => {
            const f = fields.find((fi) => fi.key === k)
            const v = result[k]
            if (v === null || v === undefined) return null
            return [f?.label ?? k, formatValue(v)] as [string, string]
          })
          .filter(Boolean) as [string, string][]

        const partesRows = fs.partes
          .map((k) => {
            const f = fields.find((fi) => fi.key === k)
            const v = result[k]
            if (v === null || v === undefined) return null
            return [f?.label ?? k, formatValue(v)] as [string, string]
          })
          .filter(Boolean) as [string, string][]

        const startYBoth = y
        const gap = 4

        if (procRows.length) {
          autoTable(doc, {
            startY: startYBoth,
            head: [['Procedimiento', '']],
            body: procRows,
            margin: { left: marginX, right: midX + gap },
            headStyles: { fillColor: [pr, pg, pb], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: base - 1.5 },
            bodyStyles: { fontSize: base - 1.5, textColor: [50, 50, 50] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: { 0: { fontStyle: 'bold', textColor: [pr, pg, pb], cellWidth: 30 } },
            theme: 'grid',
          })
        }
        const leftFinalY = procRows.length ? (doc as any).lastAutoTable.finalY : startYBoth

        if (partesRows.length) {
          autoTable(doc, {
            startY: startYBoth,
            head: [['Partes', '']],
            body: partesRows,
            margin: { left: midX + gap, right: marginX },
            headStyles: { fillColor: [sr, sg, sb], textColor: [pr, pg, pb], fontStyle: 'bold', fontSize: base - 1.5 },
            bodyStyles: { fontSize: base - 1.5, textColor: [50, 50, 50] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: { 0: { fontStyle: 'bold', textColor: [pr, pg, pb], cellWidth: 22 } },
            theme: 'grid',
          })
        }
        const rightFinalY = partesRows.length ? (doc as any).lastAutoTable.finalY : startYBoth

        y = Math.max(leftFinalY, rightFinalY) + 10
        break
      }

      // ── Timeline del asunto ──────────────────────────────────────────
      case 'timeline': {
        const events = buildTimelineEvents(result, fields)
        if (!events.length) break
        sectionTitle(sec.title)

        const lineX = marginX + 8
        const dotR = 2.5
        const rowH = 18
        const badgeW = 32

        // Pre-calcular posiciones Y de cada dot
        const dotYs: number[] = []
        let tempY = y
        for (const ev of events) {
          dotYs.push(tempY + 4)
          tempY += ev.detail ? rowH + 3 : rowH
        }

        // Línea vertical conectora (dibujada primero, detrás de los dots)
        if (events.length > 1) {
          doc.setDrawColor(pr, pg, pb)
          doc.setLineWidth(0.5)
          doc.setGState(new (doc as any).GState({ opacity: 0.3 }))
          doc.line(lineX, dotYs[0], lineX, dotYs[dotYs.length - 1])
          doc.setGState(new (doc as any).GState({ opacity: 1 }))
        }

        // Eventos
        events.forEach((ev, i) => {
          ensurePage(rowH + 5)
          const cy = dotYs[i]

          // Halo blanco alrededor del dot
          doc.setFillColor(255, 255, 255)
          doc.circle(lineX, cy, dotR + 1.5, 'F')

          // Dot de color
          doc.setFillColor(pr, pg, pb)
          doc.circle(lineX, cy, dotR, 'F')

          // Badge de fecha
          doc.setFillColor(sr, sg, sb)
          doc.roundedRect(lineX + 7, cy - 3.5, badgeW, 7, 1.5, 1.5, 'F')
          doc.setDrawColor(pr, pg, pb)
          doc.setLineWidth(0.3)
          doc.roundedRect(lineX + 7, cy - 3.5, badgeW, 7, 1.5, 1.5, 'S')

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(base - 2)
          doc.setTextColor(pr, pg, pb)
          doc.text(ev.date, lineX + 7 + badgeW / 2, cy + 0.6, { align: 'center' })

          // Etiqueta
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(base - 0.5)
          doc.setTextColor(30, 30, 50)
          doc.text(ev.label, lineX + 44, cy + 0.5)

          // Detalle
          if (ev.detail) {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(base - 2)
            doc.setTextColor(100, 100, 120)
            doc.text(ev.detail, lineX + 44, cy + 5.5)
            y += rowH + 3
          } else {
            y += rowH
          }
        })

        y += 6
        break
      }

      // ── Datos completos (sin duplicar portada) ────────────────────────
      case 'datos': {
        sectionTitle(sec.title)
        const fs = config.field_sections ?? DEFAULT_FIELD_SECTIONS
        const alreadyShown = new Set([
          ...fs.procedimiento,
          ...fs.partes,
          ...fs.calendario,
          ...SPECIAL_LIST_KEYS,
        ])

        const rows = fields
          .filter((f) => f.enabled && result[f.key] !== null && result[f.key] !== undefined && !alreadyShown.has(f.key))
          .map((f) => [f.label, formatValue(result[f.key])])

        if (rows.length) {
          autoTable(doc, {
            startY: y,
            head: [['Concepto', 'Valor extraido']],
            body: rows,
            margin: { left: marginX, right: marginX },
            headStyles: { fillColor: [pr, pg, pb], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: base - 1 },
            bodyStyles: { fontSize: base - 1, textColor: [50, 50, 50], minCellHeight: 7 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold', textColor: [60, 60, 80] } },
            theme: 'striped',
          })
          y = (doc as any).lastAutoTable.finalY + 10
        }
        break
      }

      // ── Acciones ejercitadas ─────────────────────────────────────────
      case 'acciones': {
        const acciones = result['acciones_ejercitadas']
        if (!acciones) break
        sectionTitle(sec.title)
        const items: string[] = Array.isArray(acciones) ? acciones : [String(acciones)]
        items.forEach((item, i) => {
          ensurePage(9)
          // Bullet numerado con acento de color
          doc.setFillColor(pr, pg, pb)
          doc.setGState(new (doc as any).GState({ opacity: 0.15 }))
          doc.rect(marginX, y - 4, contentW, 6.5, 'F')
          doc.setGState(new (doc as any).GState({ opacity: 1 }))

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(base - 1)
          doc.setTextColor(pr, pg, pb)
          doc.text(`${i + 1}.`, marginX + 2, y)

          doc.setFont('helvetica', 'normal')
          doc.setTextColor(40, 40, 60)
          const lines = doc.splitTextToSize(item, contentW - 10)
          doc.text(lines, marginX + 9, y)
          y += lines.length * 5 + 3
        })
        y += 4
        break
      }

      // ── Calendario procesal ──────────────────────────────────────────
      case 'calendario': {
        const fs = config.field_sections ?? DEFAULT_FIELD_SECTIONS
        const calFields = fs.calendario
        const rows = calFields
          .map((k) => {
            const f = fields.find((fi) => fi.key === k)
            const v = result[k]
            if (v === null || v === undefined) return null
            return [f?.label ?? k, k, String(v)] as [string, string, string]
          })
          .filter(Boolean) as [string, string, string][]
        if (!rows.length) break
        sectionTitle(sec.title)

        autoTable(doc, {
          startY: y,
          body: rows.map(([label, _key, rawVal]) => {
            const _k = _key
            return [label, formatBadgeValue(_k, rawVal)]
          }),
          margin: { left: marginX, right: marginX },
          bodyStyles: { fontSize: base - 1, textColor: [50, 50, 50], minCellHeight: 8 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold', textColor: [pr, pg, pb] } },
          theme: 'grid',
          didParseCell: (data) => {
            if (data.column.index !== 1) return
            const key = rows[data.row.index]?.[1]
            const val = data.cell.text[0]
            if (key === 'tipo_vista') {
              if (val === 'TELEMATICA' || val === 'TELEMÁTICA') {
                data.cell.styles.fillColor = [37, 99, 235]
                data.cell.styles.textColor = [255, 255, 255]
                data.cell.styles.fontStyle = 'bold'
              } else if (val === 'PRESENCIAL') {
                data.cell.styles.fillColor = [22, 163, 74]
                data.cell.styles.textColor = [255, 255, 255]
                data.cell.styles.fontStyle = 'bold'
              }
            } else if (key === 'inicio_acto') {
              if (val === 'AUDIENCIA PREVIA') {
                data.cell.styles.fillColor = [234, 88, 12]
                data.cell.styles.textColor = [255, 255, 255]
                data.cell.styles.fontStyle = 'bold'
              } else if (val === 'JUICIO') {
                data.cell.styles.fillColor = [185, 28, 28]
                data.cell.styles.textColor = [255, 255, 255]
                data.cell.styles.fontStyle = 'bold'
              }
            }
          },
        })
        y = (doc as any).lastAutoTable.finalY + 10
        break
      }

      // ── Excepciones procesales ───────────────────────────────────────
      case 'excepciones': {
        sectionTitle(sec.title)
        const val = result['excepciones_procesales']
        ensurePage(10)
        doc.setFontSize(base - 1)
        if (!val || (Array.isArray(val) && val.length === 0)) {
          doc.setTextColor(22, 163, 74)
          doc.setFont('helvetica', 'italic')
          doc.text('No se han alegado excepciones procesales.', marginX + 3, y)
          y += 8
        } else {
          const items: string[] = Array.isArray(val) ? val : [String(val)]
          items.forEach((item, i) => {
            ensurePage(16)
            // Cabecera de excepción (fondo rojo suave)
            doc.setFillColor(254, 226, 226)
            doc.rect(marginX, y - 4, contentW, 7, 'F')
            doc.setDrawColor(185, 28, 28)
            doc.setLineWidth(0.3)
            doc.rect(marginX, y - 4, contentW, 7, 'S')
            // Numeración
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(base - 1)
            doc.setTextColor(185, 28, 28)
            const nameLines = doc.splitTextToSize(`${i + 1}.  ${item}`, contentW - 6)
            doc.text(nameLines, marginX + 3, y)
            y += nameLines.length * 5 + 2

            const match = excepcionesConfig.find(
              (ec) => ec.nombre.trim().toLowerCase() === item.trim().toLowerCase()
                || item.trim().toLowerCase().includes(ec.nombre.trim().toLowerCase()),
            )
            if (match?.texto_asociado) {
              ensurePage(10)
              doc.setFillColor(255, 245, 245)
              doc.setFont('helvetica', 'normal')
              doc.setFontSize(base - 1.5)
              doc.setTextColor(80, 50, 50)
              const textLines = doc.splitTextToSize(match.texto_asociado, contentW - 14)
              doc.text(textLines, marginX + 8, y)
              y += textLines.length * 4.5 + 2
            }
            y += 4
          })
        }
        y += 5
        break
      }

      // ── Hechos controvertidos ────────────────────────────────────────
      case 'hechos': {
        const val = result['hechos_controvertidos']
        if (!val) break
        sectionTitle(sec.title)
        const items: string[] = Array.isArray(val) ? val : [String(val)]
        items.forEach((item, i) => {
          ensurePage(9)
          doc.setFillColor(sr, sg, sb)
          doc.rect(marginX, y - 4, contentW, 6.5, 'F')
          doc.setDrawColor(pr, pg, pb)
          doc.setLineWidth(0.2)
          doc.line(marginX, y - 4, marginX, y + 2.5)

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(base - 1)
          doc.setTextColor(pr, pg, pb)
          doc.text(`${i + 1}.`, marginX + 2, y)

          doc.setFont('helvetica', 'normal')
          doc.setTextColor(40, 40, 60)
          const lines = doc.splitTextToSize(item, contentW - 10)
          doc.text(lines, marginX + 9, y)
          y += lines.length * 5 + 3
        })
        y += 4
        break
      }

      // ── Conclusiones ─────────────────────────────────────────────────
      case 'conclusiones': {
        sectionTitle(sec.title)
        ensurePage(20)
        doc.setFontSize(base - 1)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(120, 120, 140)
        const placeholder = 'Las conclusiones y recomendaciones seran generadas por la IA una vez completada la integracion con el modelo de analisis juridico.'
        const lines = doc.splitTextToSize(placeholder, contentW - 6)
        doc.text(lines, marginX + 3, y)
        y += lines.length * 5 + 5
        break
      }

      default: {
        sectionTitle(sec.title)
        ensurePage(10)
        doc.setFontSize(base - 1)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(150, 150, 150)
        doc.text(`Seccion: ${sec.title}`, marginX + 3, y)
        y += 10
      }
    }
  }

  // ── Pies de página ────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) addFooter(i)

  // ── Guardar ───────────────────────────────────────────────────────────
  const nig = result['NIG'] ? `_${result['NIG']}` : ''
  const date = new Date().toISOString().slice(0, 10)
  doc.save(`informe_juridico${nig}_${date}.pdf`)
}
