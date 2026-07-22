-- Las plantillas de escritos son un catálogo compartido del despacho:
-- cualquier usuario autenticado debe poder verlas y usarlas para generar
-- escritos, aunque las haya subido otro compañero. Subir/editar/borrar sigue
-- restringido a quien la subió (sin cambios en esas políticas).

DROP POLICY IF EXISTS "Usuarios ven sus propias plantillas de escritos" ON instructas_plantillas;

CREATE POLICY "Usuarios autenticados ven todas las plantillas de escritos"
  ON instructas_plantillas FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Usuarios leen sus propias plantillas (storage)" ON storage.objects;

CREATE POLICY "Usuarios autenticados leen todas las plantillas (storage)"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'instructas-plantillas' AND auth.uid() IS NOT NULL);
