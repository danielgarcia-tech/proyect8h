-- Historial de escritos generados a partir de una plantilla + datos de caso
CREATE TABLE IF NOT EXISTS instructas_generados (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plantilla_id  uuid        NOT NULL REFERENCES instructas_plantillas(id) ON DELETE CASCADE,
  tipo_escrito  text        NOT NULL,
  referencia    text,
  datos_entrada jsonb       NOT NULL,
  created_at    timestamptz DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE instructas_generados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cada usuario ve sus propios escritos generados"
  ON instructas_generados FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Cada usuario inserta sus propios escritos generados"
  ON instructas_generados FOR INSERT
  WITH CHECK (auth.uid() = user_id);
