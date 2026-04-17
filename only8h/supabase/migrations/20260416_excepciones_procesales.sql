-- Tabla de excepciones procesales configuradas por el usuario
CREATE TABLE IF NOT EXISTS excepciones_procesales (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre          text        NOT NULL,
  texto_asociado  text        NOT NULL DEFAULT '',
  created_at      timestamptz DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE excepciones_procesales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propias excepciones"
  ON excepciones_procesales FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios insertan sus propias excepciones"
  ON excepciones_procesales FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios actualizan sus propias excepciones"
  ON excepciones_procesales FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios eliminan sus propias excepciones"
  ON excepciones_procesales FOR DELETE
  USING (auth.uid() = user_id);
