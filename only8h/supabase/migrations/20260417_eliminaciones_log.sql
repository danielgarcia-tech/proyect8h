-- Tabla de auditoría de eliminaciones
CREATE TABLE IF NOT EXISTS eliminaciones_log (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  historial_id         uuid        NOT NULL,
  codigo_aranzadi      text        NOT NULL,
  eliminado_por_id     uuid        NOT NULL REFERENCES auth.users(id),
  eliminado_por_email  text        NOT NULL,
  eliminado_at         timestamptz DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE eliminaciones_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cada usuario ve sus propias eliminaciones"
  ON eliminaciones_log FOR SELECT
  USING (auth.uid() = eliminado_por_id);

CREATE POLICY "Cada usuario inserta sus propias eliminaciones"
  ON eliminaciones_log FOR INSERT
  WITH CHECK (auth.uid() = eliminado_por_id);

-- Permitir DELETE en historial_analisis (solo el propio usuario)
CREATE POLICY "Cada usuario elimina sus propios análisis"
  ON historial_analisis FOR DELETE
  USING (auth.uid() = user_id);
