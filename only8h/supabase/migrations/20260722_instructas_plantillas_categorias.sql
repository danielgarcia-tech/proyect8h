-- Evoluciona instructas_plantillas de "una plantilla por tipo_escrito" a un
-- catálogo abierto categoría (carpeta) -> plantilla (archivo), con varias
-- plantillas por usuario y por categoría, y soporte para plantillas con
-- huecos [CORCHETE] además de las {llave} originales.

ALTER TABLE instructas_plantillas
  ADD COLUMN IF NOT EXISTS categoria       text,
  ADD COLUMN IF NOT EXISTS plantilla_slug  text,
  ADD COLUMN IF NOT EXISTS delimiter_style text NOT NULL DEFAULT 'curly';

-- Backfill de filas creadas por la versión anterior de la feature
-- (tipo_escrito fijo a 'demanda').
UPDATE instructas_plantillas
SET categoria = tipo_escrito, plantilla_slug = tipo_escrito
WHERE categoria IS NULL;

ALTER TABLE instructas_plantillas
  ALTER COLUMN categoria      SET NOT NULL,
  ALTER COLUMN plantilla_slug SET NOT NULL;

ALTER TABLE instructas_plantillas
  ADD CONSTRAINT instructas_plantillas_delimiter_style_check
    CHECK (delimiter_style IN ('curly', 'bracket'));

-- Evita duplicar la misma plantilla dos veces en la misma categoría; volver a
-- subir una plantilla existente debe hacer UPSERT sobre esta clave.
ALTER TABLE instructas_plantillas
  ADD CONSTRAINT instructas_plantillas_user_categoria_slug_key
    UNIQUE (user_id, categoria, plantilla_slug);

CREATE INDEX IF NOT EXISTS instructas_plantillas_user_categoria_idx
  ON instructas_plantillas (user_id, categoria);

-- tipo_escrito queda obsoleta: ya no agrupa nada, se conserva solo por
-- compatibilidad con filas antiguas y no se usa en código nuevo.
ALTER TABLE instructas_plantillas ALTER COLUMN tipo_escrito DROP NOT NULL;
COMMENT ON COLUMN instructas_plantillas.tipo_escrito IS
  'Obsoleta: sustituida por categoria + plantilla_slug. No usar en código nuevo.';
