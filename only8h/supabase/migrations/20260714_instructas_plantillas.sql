-- Plantillas .docx de escritos (demanda, contestación, etc.) configuradas por el usuario
CREATE TABLE IF NOT EXISTS instructas_plantillas (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_escrito  text        NOT NULL,
  nombre        text        NOT NULL,
  storage_path  text        NOT NULL,
  campos        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE instructas_plantillas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propias plantillas de escritos"
  ON instructas_plantillas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios insertan sus propias plantillas de escritos"
  ON instructas_plantillas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios actualizan sus propias plantillas de escritos"
  ON instructas_plantillas FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios eliminan sus propias plantillas de escritos"
  ON instructas_plantillas FOR DELETE
  USING (auth.uid() = user_id);
