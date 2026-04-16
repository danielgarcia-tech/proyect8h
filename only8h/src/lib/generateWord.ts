/**
 * Genera un documento Word (.docx) con los datos de un expediente.
 * Usa la librería `docx` (browser-compatible).
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from 'docx'
import { saveAs } from 'file-saver'
import type { ExtractionField } from './generatePdf'

// ── Helpers ────────────────────────────────────────────────────────────────
function formatVal(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (Array.isArray(val)) return val.map(String).join('\n')
  if (typeof val === 'number') return val.toLocaleString('es-ES')
  return String(val)
}

function isArray(val: unknown): val is unknown[] {
  return Array.isArray(val) && val.length > 0
}

// ── Colores corporativos ───────────────────────────────────────────────────
const BLUE  = '2B58C4'
const LGRAY = 'F8FAFC'
const DGRAY = '374151'

// ── Celda de etiqueta (columna izq) ───────────────────────────────────────
function labelCell(text: string): TableCell {
  return new TableCell({
    width: { size: 38, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: LGRAY },
    borders: { top: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, color: BLUE, size: 18 })],
    })],
  })
}

// ── Celda de valor (columna der) ───────────────────────────────────────────
function valueCell(text: string): TableCell {
  return new TableCell({
    width: { size: 62, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    children: [new Paragraph({
      children: [new TextRun({ text, color: DGRAY, size: 18 })],
    })],
  })
}

// ── Tabla de dos columnas ──────────────────────────────────────────────────
function makeTable(rows: [string, string][], title: string): (Paragraph | Table)[] {
  if (!rows.length) return []
  return [
    new Paragraph({
      text: title.toUpperCase(),
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 320, after: 120 },
      children: [new TextRun({ text: title.toUpperCase(), bold: true, color: BLUE, size: 20 })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map(([label, value]) =>
        new TableRow({
          children: [labelCell(label), valueCell(value)],
        })
      ),
    }),
  ]
}

// ── Lista numerada ─────────────────────────────────────────────────────────
function makeList(items: string[], title: string, color: string): Paragraph[] {
  if (!items.length) return []
  return [
    new Paragraph({
      spacing: { before: 320, after: 120 },
      children: [new TextRun({ text: title.toUpperCase(), bold: true, color, size: 20 })],
    }),
    ...items.map((item, i) =>
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: `${i + 1}.  `, bold: true, color, size: 18 }),
          new TextRun({ text: item, color: DGRAY, size: 18 }),
        ],
      })
    ),
  ]
}

// ── Generador principal ────────────────────────────────────────────────────
export async function generateWord(
  resultado: Record<string, unknown>,
  fields: ExtractionField[],
  codigoAranzadi: string,
  firmName = '',
): Promise<void> {
  const fieldMap = Object.fromEntries(fields.map((f) => [f.key, f.label]))

  // ── SECCIÓN 1: Datos del procedimiento ──
  const procKeys = ['NIG', 'procedimiento', 'juzgado', 'numero_autos', 'cuantia', 'fecha_presentacion']
  const procRows: [string, string][] = procKeys
    .filter((k) => resultado[k] !== null && resultado[k] !== undefined)
    .map((k) => [fieldMap[k] ?? k, formatVal(resultado[k])])

  // ── SECCIÓN 2: Partes ──
  const partesKeys = ['demandante', 'demandado', 'procurador', 'abogado']
  const partesRows: [string, string][] = partesKeys
    .filter((k) => resultado[k] !== null && resultado[k] !== undefined)
    .map((k) => [fieldMap[k] ?? k, formatVal(resultado[k])])

  // ── SECCIÓN 3: Vista ──
  const vistaKeys = ['dia_vista', 'tipo_vista', 'inicio_acto', 'telefono_incidencias']
  const vistaRows: [string, string][] = vistaKeys
    .filter((k) => resultado[k] !== null && resultado[k] !== undefined)
    .map((k) => [fieldMap[k] ?? k, formatVal(resultado[k])])

  // ── SECCIÓN 4: Acciones ejercitadas ──
  const acciones = isArray(resultado['acciones_ejercitadas'])
    ? (resultado['acciones_ejercitadas'] as string[])
    : resultado['acciones_ejercitadas'] ? [formatVal(resultado['acciones_ejercitadas'])] : []

  // ── SECCIÓN 5: Excepción procesal ──
  const excepciones = isArray(resultado['excepciones_procesales'])
    ? (resultado['excepciones_procesales'] as string[])
    : []

  // ── SECCIÓN 6: Hechos controvertidos ──
  const hechos = isArray(resultado['hechos_controvertidos'])
    ? (resultado['hechos_controvertidos'] as string[])
    : []

  // ── Campos adicionales no categorizados ──
  const knownKeys = new Set([...procKeys, ...partesKeys, ...vistaKeys,
    'acciones_ejercitadas', 'excepciones_procesales', 'hechos_controvertidos'])
  const extraRows: [string, string][] = Object.entries(resultado)
    .filter(([k, v]) => !knownKeys.has(k) && v !== null && v !== undefined)
    .map(([k, v]) => [fieldMap[k] ?? k, formatVal(v)])

  // ── Cabecera del documento ──
  const titleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: firmName || 'INFORME JURÍDICO', bold: true, color: BLUE, size: 32 })],
  })

  const subtitleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: `Código Aranzadi: ${codigoAranzadi}`, bold: true, color: DGRAY, size: 22 })],
  })

  const dateParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({
      text: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
      color: '9CA3AF', size: 18,
    })],
  })

  const divider = new Paragraph({
    spacing: { before: 200, after: 200 },
    children: [new TextRun({ text: '' })],
  })

  // ── Construir cuerpo ──
  const body: (Paragraph | Table)[] = [
    titleParagraph,
    subtitleParagraph,
    dateParagraph,
    ...makeTable(procRows,   '1. Datos del procedimiento'),
    divider,
    ...makeTable(partesRows, '2. Partes intervinientes'),
    divider,
    ...makeTable(vistaRows,  '3. Vista procesal'),
    divider,
    ...makeList(acciones,    '4. Acciones ejercitadas', '059669'),
    divider,
    ...(excepciones.length
      ? makeList(excepciones, '5. Excepción procesal', 'DC2626')
      : [new Paragraph({
          spacing: { before: 320, after: 80 },
          children: [
            new TextRun({ text: '5. EXCEPCIÓN PROCESAL'.toUpperCase(), bold: true, color: 'DC2626', size: 20 }),
          ],
        }),
        new Paragraph({
          children: [new TextRun({ text: 'No se han alegado excepciones procesales.', color: '6B7280', size: 18, italics: true })],
        })]),
    divider,
    ...makeList(hechos,      '6. Hechos controvertidos', '0891B2'),
    ...(extraRows.length ? [divider, ...makeTable(extraRows, 'Otros datos')] : []),
  ]

  const doc = new Document({
    numbering: { config: [] },
    sections: [{
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: firmName || 'ONLY8H — Informe jurídico', color: '9CA3AF', size: 16 })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Página ', color: '9CA3AF', size: 16 }),
              new TextRun({ children: [PageNumber.CURRENT], color: '9CA3AF', size: 16 }),
              new TextRun({ text: ' de ', color: '9CA3AF', size: 16 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], color: '9CA3AF', size: 16 }),
            ],
          })],
        }),
      },
      properties: {
        page: {
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 }, // ~2cm
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
