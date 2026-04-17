/**
 * Extracts plain text from PDF and DOCX files.
 * PDF uses pdf.js (loaded via CDN worker), DOCX uses mammoth.
 *
 * Si un PDF supera TRUNCATE_THRESHOLD páginas, solo se procesan
 * las primeras MAX_PAGES para no saturar el contexto de la IA.
 */

const TRUNCATE_THRESHOLD = 100
const MAX_PAGES = 75

export interface ExtractionResult {
  text: string
  truncated?: { total: number; processed: number }
}

export async function extractTextFromFile(file: File): Promise<ExtractionResult> {
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    return extractFromPDF(file)
  }
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.endsWith('.docx')
  ) {
    return extractFromDOCX(file)
  }
  throw new Error(`Tipo de archivo no soportado: ${file.type || file.name}`)
}

async function extractFromPDF(file: File): Promise<ExtractionResult> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.6.205/build/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const totalPages = pdf.numPages
  const limit = totalPages > TRUNCATE_THRESHOLD ? MAX_PAGES : totalPages

  const pages: string[] = []
  for (let i = 1; i <= limit; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(text)
  }

  return {
    text: pages.join('\n\n'),
    truncated: totalPages > TRUNCATE_THRESHOLD ? { total: totalPages, processed: limit } : undefined,
  }
}

async function extractFromDOCX(file: File): Promise<ExtractionResult> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return { text: result.value }
}
