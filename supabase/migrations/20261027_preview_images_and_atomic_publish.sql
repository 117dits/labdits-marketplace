-- Public screenshots from verified demo deployments; immutable writes by server worker only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('preview-images', 'preview-images', true, 5242880, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png'];

CREATE POLICY "preview images public read" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'preview-images');

-- This endpoint is callable by service_role ONLY. Compare the complete original JSONB
-- in a request body so large uploaded projects do not become oversized query strings.
-- Update only media fields; do not replace a concurrent admin edit or an existing video.
CREATE OR REPLACE FUNCTION public.publish_preview_assets(
  product_id text,
  expected_data jsonb,
  asset_patch jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  current_data jsonb;
  thumbnail text;
  video text;
BEGIN
  IF asset_patch IS NULL OR jsonb_typeof(asset_patch) <> 'object' OR asset_patch = '{}'::jsonb
     OR (asset_patch - 'previewThumbnailUrl' - 'previewVideoUrl') <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Invalid media patch';
  END IF;
  thumbnail := asset_patch->>'previewThumbnailUrl';
  video := asset_patch->>'previewVideoUrl';
  IF asset_patch ? 'previewThumbnailUrl' AND
     (thumbnail IS NULL OR thumbnail !~ '^https://[a-z0-9-]+[.]supabase[.]co/storage/v1/object/public/preview-images/[a-f0-9-]+[.]png$') THEN
    RAISE EXCEPTION 'Invalid screenshot URL';
  END IF;
  IF asset_patch ? 'previewVideoUrl' AND
     (video IS NULL OR video !~ '^https://[a-z0-9-]+[.]supabase[.]co/storage/v1/object/public/preview-videos/[a-f0-9-]+[.]mp4$') THEN
    RAISE EXCEPTION 'Invalid video URL';
  END IF;
  SELECT data INTO current_data FROM public.products
    WHERE id = product_id AND status = 'published' FOR UPDATE;
  IF NOT FOUND OR current_data IS DISTINCT FROM expected_data
     OR current_data#>>'{project,deployment,status}' <> 'ready'
     OR current_data#>>'{project,deployment,verified}' <> 'true'
     OR (thumbnail IS NOT NULL AND NULLIF(current_data->>'previewThumbnailUrl', '') IS NOT NULL)
     OR (video IS NOT NULL AND NULLIF(current_data->>'previewVideoUrl', '') IS NOT NULL) THEN
    RETURN false;
  END IF;
  UPDATE public.products SET data = current_data || asset_patch WHERE id = product_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_preview_assets(text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_preview_assets(text, jsonb, jsonb) TO service_role;
