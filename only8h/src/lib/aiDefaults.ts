import type { ExtractionField } from './generatePdf'

export const DEFAULT_AI_MODEL = 'claude-sonnet-4-6'

export const DEFAULT_SYSTEM_PROMPT = `Eres un asistente jurídico especializado en análisis de documentos procesales españoles.

Analiza todos los documentos proporcionados y extrae los datos indicados en formato JSON estricto.
Devuelve ÚNICAMENTE el objeto JSON, sin texto adicional ni bloques de código.

Reglas generales:
- Si un campo no aparece en ningún documento, devuelve null.
- Normaliza los nombres propios en mayúsculas/minúsculas estándar.
- Las fechas siguen el formato ISO 8601 (YYYY-MM-DD).
- La cuantía es un número sin símbolo de moneda ni separadores de miles.
- tipo_vista: devuelve exactamente "PRESENCIAL" o "TELEMÁTICA".
- inicio_acto: devuelve exactamente "AUDIENCIA_PREVIA" o "JUICIO".
- cuantia: extrae siempre del EMPLAZAMIENTO, no de la demanda.
- acciones_ejercitadas y excepciones_procesales y hechos_controvertidos: devuelve array de strings.`

export const DEFAULT_FIELDS: ExtractionField[] = [
  {
    id: '1', key: 'NIG', label: 'Número de Identificación General', enabled: true,
    context: 'Código único de 16 dígitos asignado por el sistema judicial español (LEXNET). Aparece en la cabecera de todos los escritos. Formato habitual: 28079470120240012345.',
  },
  {
    id: '2', key: 'procedimiento', label: 'Tipo de procedimiento', enabled: true,
    context: 'Indica la clase de proceso: juicio ordinario (cuantía >6.000 €), juicio verbal (≤6.000 €), monitorio, cambiario, etc. Extrae el término exacto que figure en el encabezado del escrito.',
  },
  {
    id: '3', key: 'juzgado', label: 'Juzgado competente', enabled: true,
    context: 'Nombre completo del órgano judicial incluyendo número y partido judicial. Ejemplo: "Juzgado de 1.ª Instancia n.º 3 de Madrid". Extrae del encabezado del emplazamiento o demanda.',
  },
  {
    id: '4', key: 'numero_autos', label: 'Número de autos', enabled: true,
    context: 'Número de expediente asignado por el juzgado. Suele aparecer como "Autos n.º XXX/YYYY" o "Procedimiento n.º XXX/YYYY" en el emplazamiento.',
  },
  {
    id: '5', key: 'dia_vista', label: 'Día de vista', enabled: true,
    context: 'Fecha y hora exactas del acto de juicio o audiencia previa según conste en el emplazamiento. Devuelve la fecha en formato ISO 8601 (YYYY-MM-DD) y la hora como cadena "HH:MM".',
  },
  {
    id: '6', key: 'telefono_incidencias', label: 'Teléfono de incidencias del juzgado', enabled: true,
    context: 'Número de teléfono facilitado por el juzgado para comunicar incidencias técnicas (habitual en vistas telemáticas). Suele figurar al pie del emplazamiento o citación.',
  },
  {
    id: '7', key: 'tipo_vista', label: 'Tipo de vista', enabled: true,
    context: 'Modalidad de celebración del acto: devuelve exactamente "PRESENCIAL" o "TELEMÁTICA" según indique el emplazamiento. Si no se especifica, devuelve "PRESENCIAL".',
  },
  {
    id: '8', key: 'demandante', label: 'Demandante', enabled: true,
    context: 'Nombre completo o razón social de la parte actora. En asuntos de consumo suele ser una persona física frente a una entidad financiera. Extrae de la demanda o del emplazamiento.',
  },
  {
    id: '9', key: 'demandado', label: 'Demandado', enabled: true,
    context: 'Nombre completo o razón social de la parte demandada. En asuntos de tarjetas revolving suele ser el banco o entidad financiera emisora.',
  },
  {
    id: '10', key: 'procurador', label: 'Procurador', enabled: true,
    context: 'Nombre del procurador que representa a la parte. Puede figurar en el encabezamiento de la demanda o en la diligencia de emplazamiento. Incluye "D." o "D.ª" si aparece.',
  },
  {
    id: '11', key: 'abogado', label: 'Abogado', enabled: true,
    context: 'Nombre del letrado que dirige la defensa. Aparece en el encabezamiento de la demanda o en el otrosí de designación. Incluye colegio y número de colegiado si constan.',
  },
  {
    id: '12', key: 'cuantia', label: 'Cuantía del procedimiento (€)', enabled: true,
    context: 'Importe reclamado. EXTRAE SIEMPRE DEL EMPLAZAMIENTO, no de la demanda. Devuelve un número sin símbolo de moneda ni separadores de miles. Ejemplo: 4823.50',
  },
  {
    id: '13', key: 'acciones_ejercitadas', label: 'Acciones ejercitadas', enabled: true,
    context: 'Resumen conciso en array de strings de los puntos del SOLICITO (petitum) de la demanda. Máximo 5 bullets. Cada bullet debe ser una frase breve en infinitivo. Ejemplo: ["Declarar la nulidad del contrato", "Condenar a la devolución de 4.823,50 €"].',
  },
  {
    id: '14', key: 'inicio_acto', label: 'Inicio del acto procesal', enabled: true,
    context: 'Indica si el procedimiento se inicia con AUDIENCIA_PREVIA (juicio ordinario) o directamente con JUICIO (juicio verbal). Extrae del emplazamiento. Devuelve exactamente "AUDIENCIA_PREVIA" o "JUICIO".',
  },
  {
    id: '15', key: 'excepciones_procesales', label: 'Excepciones procesales', enabled: true,
    context: 'Excepciones procesales o materiales alegadas por el demandado en la contestación (falta de legitimación, cosa juzgada, prescripción, caducidad, etc.). Devuelve array de strings o null si no se alegan excepciones.',
  },
  {
    id: '16', key: 'hechos_controvertidos', label: 'Hechos controvertidos', enabled: true,
    context: 'Hechos de la demanda que el demandado niega, matiza o contradice en la contestación. Extrae los puntos principales en array de strings concisos. Omite los hechos que el demandado admite.',
  },
  {
    id: '17', key: 'fecha_presentacion', label: 'Fecha de presentación de la demanda', enabled: false,
    context: 'Fecha en que se registró la demanda en el juzgado. Suele constar en el sello de registro o en la diligencia de admisión. Formato ISO 8601 (YYYY-MM-DD).',
  },
]
