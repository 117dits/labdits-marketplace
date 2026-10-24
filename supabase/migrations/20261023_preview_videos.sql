-- Uploaded project videos only: public playback, admin-only immutable uploads.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('preview-videos', 'preview-videos', true, 26214400, ARRAY['video/mp4', 'video/webm'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 26214400,
  allowed_mime_types = ARRAY['video/mp4', 'video/webm'];

CREATE POLICY "preview videos public read" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'preview-videos');
CREATE POLICY "preview videos admin insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'preview-videos' AND public.has_role(auth.uid(), 'admin'));
-- No UPDATE/DELETE policy: recordings cannot be overwritten by browser clients.
