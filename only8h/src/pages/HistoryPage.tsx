import { Download, FileText, Inbox } from 'lucide-react'

interface HistoryEntry {
  id: string
  title: string
  created_at: string
  file_names: string[]
  pdf_url: string
}

// ── Mock data — se reemplazará con consulta real a Supabase ────────────────
const MOCK_HISTORY: HistoryEntry[] = [
  {
    id: '1',
    title: 'Contrato de arrendamiento — Local comercial C/ Mayor 12',
    created_at: '2026-04-14T10:23:00Z',
    file_names: ['contrato_arrendamiento.pdf', 'anexo_condiciones.docx'],
    pdf_url: '#',
  },
  {
    id: '2',
    title: 'Acuerdo de confidencialidad — Proyecto Omega',
    created_at: '2026-04-10T16:05:00Z',
    file_names: ['NDA_omega_v2.docx'],
    pdf_url: '#',
  },
  {
    id: '3',
    title: 'Estatutos sociales — Constitución SL',
    created_at: '2026-04-07T09:40:00Z',
    file_names: ['estatutos_mercantil.pdf'],
    pdf_url: '#',
  },
]
// ──────────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Inbox className="w-7 h-7 text-gray-400" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-gray-700 mb-1">
        Sin informes todavía
      </h3>
      <p className="text-sm text-gray-400 max-w-xs">
        Cuando realices un análisis, los informes aparecerán aquí para que
        puedas consultarlos y descargarlos.
      </p>
    </div>
  )
}

interface HistoryRowProps {
  entry: HistoryEntry
}

function HistoryRow({ entry }: HistoryRowProps) {
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5 w-8 h-8 bg-[#2B58C4]/10 rounded-lg flex items-center justify-center">
            <FileText
              className="w-4 h-4 text-[#2B58C4]"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 leading-snug">
              {entry.title}
            </p>
            <ul className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
              {entry.file_names.map((name) => (
                <li key={name} className="text-xs text-gray-400 truncate max-w-[200px]">
                  {name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 whitespace-nowrap">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
          {entry.file_names.length} doc{entry.file_names.length !== 1 ? 's' : ''}
        </span>
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-500">
        {formatDate(entry.created_at)}
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-right">
        <a
          href={entry.pdf_url}
          download
          aria-label={`Descargar informe: ${entry.title}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2B58C4] border border-[#2B58C4]/30 rounded-lg hover:bg-[#2B58C4] hover:text-white hover:border-[#2B58C4] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2B58C4] focus:ring-offset-1"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          Descargar PDF
        </a>
      </td>
    </tr>
  )
}

export default function HistoryPage() {
  // TODO: replace with real Supabase query
  const reports = MOCK_HISTORY

  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Historial de análisis</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Todos los informes generados por el equipo
          </p>
        </div>
        {reports.length > 0 && (
          <span className="text-sm text-gray-400">
            {reports.length} informe{reports.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <EmptyState />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table
              className="w-full"
              aria-label="Historial de informes de análisis"
            >
              <thead>
                <tr className="bg-gray-50">
                  <th
                    scope="col"
                    className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    Informe
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    Documentos
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    Fecha
                  </th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {reports.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
