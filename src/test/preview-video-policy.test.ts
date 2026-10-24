import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('preview video storage policy', () => {
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261023_preview_videos.sql'), 'utf8');
  it('limits public videos to 25 MB and only MP4/WebM', () => {
    expect(migration).toContain('26214400');
    expect(migration).toContain('video/mp4');
    expect(migration).toContain('video/webm');
  });
  it('permits uploads only for authenticated admins', () => {
    expect(migration).toContain("public.has_role(auth.uid(), 'admin')");
    expect(migration).toContain("bucket_id = 'preview-videos'");
  });
});
