-- Renombra tipo_escrito -> categoria para reflejar que ya no es un tipo de
-- escrito fijo sino la categoría (carpeta) abierta de la plantilla usada
-- para generar el escrito. Las políticas RLS existentes no referencian el
-- nombre de esta columna, así que no se ven afectadas por el rename.
ALTER TABLE instructas_generados RENAME COLUMN tipo_escrito TO categoria;
