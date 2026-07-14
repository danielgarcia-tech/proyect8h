-- Bucket privado para las plantillas .docx de escritos, un objeto por usuario
-- bajo el prefijo de carpeta <user_id>/...
INSERT INTO storage.buckets (id, name, public)
VALUES ('instructas-plantillas', 'instructas-plantillas', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Usuarios leen sus propias plantillas (storage)"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'instructas-plantillas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Usuarios suben sus propias plantillas (storage)"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'instructas-plantillas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Usuarios reemplazan sus propias plantillas (storage)"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'instructas-plantillas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'instructas-plantillas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Usuarios eliminan sus propias plantillas (storage)"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'instructas-plantillas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
