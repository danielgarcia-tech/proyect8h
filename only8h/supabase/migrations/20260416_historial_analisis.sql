-- Tabla de historial de análisis
CREATE TABLE IF NOT EXISTS historial_analisis (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo_aranzadi text        NOT NULL,
  equipo          text,
  documentos      text[],
  resultado       jsonb       NOT NULL,
  created_at      timestamptz DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE historial_analisis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cada usuario ve solo sus propios análisis"
  ON historial_analisis FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Cada usuario inserta sus propios análisis"
  ON historial_analisis FOR INSERT
  WITH CHECK (auth.uid() = user_id);
