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
}

export type AnalysisResult = Record<string, unknown>

// ── Helpers ────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const n = parseInt(clean, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (Array.isArray(val)) return val.map((v, i) => `${i + 1}. ${v}`).join('\n')
  if (typeof val === 'number') return val.toLocaleString('es-ES')
  return String(val)
}

function baseFontSize(size: string): number {
  if (size === 'small') return 9
  if (size === 'large') return 11
  return 10
}

// ── Generador principal ─────────────────────────────────────────────────────
export function generatePdf(
  result: AnalysisResult,
  fields: ExtractionField[],
  config: ReportConfig,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 15
  const contentW = pageW - marginX * 2
  const [pr, pg, pb] = hexToRgb(config.primary_color)
  const [sr, sg, sb] = hexToRgb(config.secondary_color)
  const base = baseFontSize(config.font_size)

  let y = 0

  // ── Función pie de página ──────────────────────────────────────────────
  function addFooter(pageNum: number) {
    const total = doc.getNumberOfPages()
    doc.setPage(pageNum)
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 160)
    const footer = config.footer_text || 'Documento generado automáticamente por ONLY8H · Confidencial'
    doc.text(footer, marginX, pageH - 8)
    doc.text(`Página ${pageNum} de ${total}`, pageW - marginX, pageH - 8, { align: 'right' })
    // línea separadora
    doc.setDrawColor(220, 220, 220)
    doc.line(marginX, pageH - 11, pageW - marginX, pageH - 11)
  }

  // ── CABECERA ──────────────────────────────────────────────────────────
  // Fondo color primario
  doc.setFillColor(pr, pg, pb)
  doc.rect(0, 0, pageW, 38, 'F')

  // Nombre del despacho
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(base + 6)
  doc.setTextColor(255, 255, 255)
  doc.text(config.firm_name || 'Despacho Jurídico', marginX, 14)

  // Tagline
  if (config.firm_tagline) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(base - 1)
    doc.setTextColor(255, 255, 255)
    doc.setGState(new (doc as any).GState({ opacity: 0.75 }))
    doc.text(config.firm_tagline, marginX, 20)
    doc.setGState(new (doc as any).GState({ opacity: 1 }))
  }

  // Título del informe (derecha)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(base - 1)
  doc.setTextColor(255, 255, 255)
  doc.text('INFORME JURÍDICO', pageW - marginX, 12, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(base - 2)
  doc.text(
    new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
    pageW - marginX, 18, { align: 'right' }
  )

  // Franja de contacto (fondo secundario)
  doc.setFillColor(sr, sg, sb)
  doc.rect(0, 38, pageW, 12, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 100, 100)
  const contacts: string[] = []
  if (config.firm_address) contacts.push(`📍 ${config.firm_address}`)
  if (config.firm_phone)   contacts.push(`📞 ${config.firm_phone}`)
  if (config.firm_email)   contacts.push(`✉ ${config.firm_email}`)
  if (config.firm_web)     contacts.push(`🌐 ${config.firm_web}`)
  doc.text(contacts.join('   '), marginX, 45.5)

  // Línea de color
  doc.setDrawColor(pr, pg, pb)
  doc.setLineWidth(0.8)
  doc.line(0, 50, pageW, 50)

  y = 58

  // ── SECCIONES ────────────────────────────────────────────────────────
  const enabledSections = config.sections.filter((s) => s.enabled)

  function sectionTitle(title: string) {
    // Comprueba salto de página
    if (y > pageH - 35) { doc.addPage(); y = 20 }

    doc.setFillColor(pr, pg, pb)
    doc.rect(marginX, y - 4, contentW, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(base - 0.5)
    doc.setTextColor(255, 255, 255)
    doc.text(title.toUpperCase(), marginX + 3, y + 0.5)
    y += 8
  }

  function ensurePage(needed: number) {
    if (y + needed > pageH - 18) { doc.addPage(); y = 20 }
  }

  for (const sec of enabledSections) {
    switch (sec.id) {

      // ── Portada: resumen de datos clave ──────────────────────────────
      case 'portada': {
        sectionTitle(sec.title)
        const keyFields = ['NIG', 'juzgado', 'numero_autos', 'demandante', 'demandado', 'cuantia']
        const rows = keyFields
          .map((k) => {
            const f = fields.find((fi) => fi.key === k)
            const v = result[k]
            if (v === null || v === undefined) return null
            return [f?.label ?? k, formatValue(v)]
          })
          .filter(Boolean) as [string, string][]

        if (rows.length) {
          autoTable(doc, {
            startY: y,
            head: [['Campo', 'Valor']],
            body: rows,
            margin: { left: marginX, right: marginX },
            headStyles: { fillColor: [sr, sg, sb], textColor: [pr, pg, pb], fontStyle: 'bold', fontSize: base - 1 },
            bodyStyles: { fontSize: base - 1, textColor: [50, 50, 50] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold', textColor: [pr, pg, pb] } },
            theme: 'grid',
          })
          y = (doc as any).lastAutoTable.finalY + 10
        }
        break
      }

      // ── Datos completos del procedimiento ────────────────────────────
      case 'datos': {
        sectionTitle(sec.title)
        const rows = fields
          .filter((f) => f.enabled && result[f.key] !== null && result[f.key] !== undefined)
          .map((f) => [f.label, formatValue(result[f.key])])

        if (rows.length) {
          autoTable(doc, {
            startY: y,
            head: [['Concepto', 'Valor extraído']],
            body: rows,
            margin: { left: marginX, right: marginX },
            headStyles: { fillColor: [pr, pg, pb], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: base - 1 },
            bodyStyles: { fontSize: base - 1, textColor: [50, 50, 50], minCellHeight: 7 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold', textColor: [60, 60, 80] } },
            theme: 'striped',
          })
          y = (doc as any).lastAutoTable.finalY + 10
        } else {
          ensurePage(10)
          doc.setFontSize(base - 1)
          doc.setTextColor(150, 150, 150)
          doc.text('No se han extraído datos del procedimiento.', marginX, y)
          y += 10
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
          ensurePage(8)
          doc.setFontSize(base - 1)
          doc.setTextColor(50, 50, 50)
          doc.setFont('helvetica', 'normal')
          const lines = doc.splitTextToSize(`${i + 1}.  ${item}`, contentW - 6)
          doc.text(lines, marginX + 3, y)
          y += lines.length * 5 + 2
        })
        y += 5
        break
      }

      // ── Calendario procesal ──────────────────────────────────────────
      case 'calendario': {
        const calFields = ['dia_vista', 'tipo_vista', 'inicio_acto', 'telefono_incidencias']
        const rows = calFields
          .map((k) => {
            const f = fields.find((fi) => fi.key === k)
            const v = result[k]
            if (v === null || v === undefined) return null
            return [f?.label ?? k, formatValue(v)]
          })
          .filter(Boolean) as [string, string][]
        if (!rows.length) break
        sectionTitle(sec.title)
        autoTable(doc, {
          startY: y,
          body: rows,
          margin: { left: marginX, right: marginX },
          bodyStyles: { fontSize: base - 1, textColor: [50, 50, 50] },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold', textColor: [pr, pg, pb] } },
          theme: 'grid',
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
          doc.setTextColor(100, 150, 100)
          doc.setFont('helvetica', 'italic')
          doc.text('No se han alegado excepciones procesales.', marginX + 3, y)
          y += 8
        } else {
          const items: string[] = Array.isArray(val) ? val : [String(val)]
          items.forEach((item, i) => {
            ensurePage(8)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(50, 50, 50)
            const lines = doc.splitTextToSize(`${i + 1}.  ${item}`, contentW - 6)
            doc.text(lines, marginX + 3, y)
            y += lines.length * 5 + 2
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
          ensurePage(8)
          doc.setFontSize(base - 1)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(50, 50, 50)
          const lines = doc.splitTextToSize(`${i + 1}.  ${item}`, contentW - 6)
          doc.text(lines, marginX + 3, y)
          y += lines.length * 5 + 2
        })
        y += 5
        break
      }

      // ── Conclusiones ─────────────────────────────────────────────────
      case 'conclusiones': {
        sectionTitle(sec.title)
        ensurePage(20)
        doc.setFontSize(base - 1)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(100, 100, 100)
        const placeholder = 'Las conclusiones y recomendaciones serán generadas por la IA una vez completada la integración con el modelo de análisis jurídico.'
        const lines = doc.splitTextToSize(placeholder, contentW - 6)
        doc.text(lines, marginX + 3, y)
        y += lines.length * 5 + 5
        break
      }

      // ── Sección personalizada (título + sin contenido específico) ────
      default: {
        sectionTitle(sec.title)
        ensurePage(10)
        doc.setFontSize(base - 1)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(150, 150, 150)
        doc.text(`Sección: ${sec.title}`, marginX + 3, y)
        y += 10
      }
    }
  }

  // ── Añadir pies de página en todas las páginas ────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) addFooter(i)

  // ── Guardar ───────────────────────────────────────────────────────────
  const nig = result['NIG'] ? `_${result['NIG']}` : ''
  const date = new Date().toISOString().slice(0, 10)
  doc.save(`informe_juridico${nig}_${date}.pdf`)
}
