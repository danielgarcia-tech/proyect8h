export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  storagePath?: string
  content?: string
}

export interface AnalysisReport {
  id: string
  user_id: string
  created_at: string
  title: string
  file_names: string[]
  pdf_url: string
  analysis: DocumentAnalysis
}

export interface DocumentAnalysis {
  titulo: string
  fecha_analisis: string
  documentos_analizados: string[]
  partes_intervinientes: Party[]
  objeto_principal: string
  clausulas_clave: Clause[]
  riesgos: Risk[]
  conclusion: string
  recomendaciones: string[]
}

export interface Party {
  nombre: string
  rol: string
  identificacion?: string
}

export interface Clause {
  titulo: string
  descripcion: string
  importancia: 'alta' | 'media' | 'baja'
}

export interface Risk {
  descripcion: string
  nivel: 'alto' | 'medio' | 'bajo'
  clausula_ref?: string
}
