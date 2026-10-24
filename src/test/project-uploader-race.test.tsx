import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProjectUploader } from '@/components/admin/project-uploader';
import type { ProjectRecord } from '@/types/deployment';

const mocks = vi.hoisted(() => ({
  analyze: vi.fn(), discover: vi.fn(), uploadVideo: vi.fn(), upload: vi.fn(), serverAnalyze: vi.fn(),
  metadata: vi.fn(),
}));
vi.mock('@/lib/project-analyzer', () => ({
  entriesFromFiles: (files: File[]) => files.map(file => ({ path: file.name, size: file.size, read: async () => '' })),
  inspectEntries: (entries: unknown[]) => ({ entries, problems: [], totalSize: 12, root: '' }),
  readZipEntries: vi.fn(), analyzeProject: mocks.analyze,
}));
vi.mock('@/lib/preview-video', () => ({ discoverPreviewVideo: mocks.discover, uploadPreviewVideo: mocks.uploadVideo }));
vi.mock('@/lib/project-meta-extractor', () => ({ extractProjectMetadata: mocks.metadata }));
vi.mock('@/services/deployment-service', () => ({
  BackendNotConnectedError: class extends Error {}, isDeploymentBackendConnected: () => true,
  deploymentService: { upload: mocks.upload, analyze: mocks.serverAnalyze }, pollDeployment: () => () => {},
}));
const analysis = { compatibility: 'supported', framework: 'Vite', language: 'JavaScript', styling: [], packageManager: 'npm', envKeys: [], keyFiles: [], notes: [], projectName: 'Test', confidence: 'high', envRequired: false };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
function harness(initial?: ProjectRecord, beforeUpload?: () => Promise<string>) {
  let current = initial;
  const changes: Array<ProjectRecord | undefined> = [];
  const video = vi.fn();
  const metadata = vi.fn();
  function Host() {
    const [value, setValue] = React.useState(current);
    return <ProjectUploader productId="p" value={value} onChange={p => { current = p; changes.push(p); setValue(p); }} {...(beforeUpload ? { onBeforeUpload: beforeUpload } : {})} onVideoUploaded={video} onAutoExtracted={metadata} />;
  }
  const view = render(<Host />);
  const choose = (name: string) => fireEvent.change(view.container.querySelector('input[type=file]:not([webkitdirectory])')!, { target: { files: [new File(['test'], name)] } });
  return { ...view, choose, changes, video, metadata, get current() { return current; } };
}
import * as React from 'react';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.analyze.mockResolvedValue(analysis);
  mocks.discover.mockResolvedValue(null);
  mocks.metadata.mockResolvedValue({});
  mocks.upload.mockResolvedValue({ projectId: 'server', uploadId: 'up' });
  mocks.serverAnalyze.mockResolvedValue({ analysis });
});

describe('ProjectUploader selection isolation', () => {
  it('ignores late analysis of a replaced selection', async () => {
    const first = deferred<typeof analysis>();
    mocks.analyze.mockImplementationOnce(() => first.promise).mockResolvedValueOnce(analysis);
    const h = harness();
    h.choose('old.js');
    await waitFor(() => expect(mocks.analyze).toHaveBeenCalledTimes(1));
    h.choose('new.js');
    await waitFor(() => expect(h.current?.files[0]?.path).toBe('new.js'));
    first.resolve({ ...analysis, projectName: 'Old' });
    await waitFor(() => expect(h.current?.analysis?.projectName).toBe('Test'));
    expect(h.current?.files[0]?.path).toBe('new.js');
    expect(h.current?.analysis?.projectName).not.toBe('Old');
  });

  it('does not let a late upload overwrite a replacement or emit stale metadata', async () => {
    const first = deferred<{ projectId: string; uploadId: string }>();
    mocks.upload.mockReturnValueOnce(first.promise);
    mocks.metadata.mockResolvedValue({ title: 'Old' });
    const h = harness();
    h.choose('old.js');
    await waitFor(() => expect(screen.getByRole('button', { name: /Upload project/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Upload project/i }));
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
    h.choose('new.js');
    await waitFor(() => expect(h.current?.files[0]?.path).toBe('new.js'));
    first.resolve({ projectId: 'old-server', uploadId: 'old-up' });
    await waitFor(() => expect(h.current?.analysis).toBeDefined());
    expect(h.current?.projectId).toBeUndefined();
    expect(h.metadata).not.toHaveBeenCalled();
  });

  it('holds completion until server analysis finishes', async () => {
    const pending = deferred<{ analysis: typeof analysis }>();
    mocks.serverAnalyze.mockReturnValueOnce(pending.promise);
    const h = harness();
    h.choose('app.js');
    await waitFor(() => expect(screen.getByRole('button', { name: /Upload project/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Upload project/i }));
    await waitFor(() => expect(h.current?.uploadId).toBe('up'));
    expect(h.current?.localStatus).toBe('analyzing');
    pending.resolve({ analysis });
    await waitFor(() => expect(h.current?.localStatus).toBe('pending'));
  });

  it('requires explicit public-video consent before copying a discovered video', async () => {
    mocks.discover.mockResolvedValue(new File(['video'], 'preview.mp4', { type: 'video/mp4' }));
    mocks.uploadVideo.mockResolvedValue('https://public.example/preview.mp4');
    const h = harness();
    h.choose('app.js');
    await waitFor(() => expect(screen.getByRole('button', { name: /Upload project/i })).not.toBeDisabled());
    expect(screen.getByRole('checkbox', { name: /URL becomes public/i })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Upload project/i }));
    await waitFor(() => expect(h.current?.localStatus).toBe('pending'));
    expect(mocks.uploadVideo).not.toHaveBeenCalled();
    expect(h.video).not.toHaveBeenCalled();
  });

  it('uploads a discovered video only after explicit consent', async () => {
    mocks.discover.mockResolvedValue(new File(['video'], 'preview.mp4', { type: 'video/mp4' }));
    mocks.uploadVideo.mockResolvedValue('https://public.example/preview.mp4');
    const h = harness();
    h.choose('app.js');
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /URL becomes public/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('checkbox', { name: /URL becomes public/i }));
    fireEvent.click(screen.getByRole('button', { name: /Upload project/i }));
    await waitFor(() => expect(h.video).toHaveBeenCalledWith('https://public.example/preview.mp4'));
    expect(mocks.uploadVideo).toHaveBeenCalledTimes(1);
  });

  it('never starts backend upload when draft persistence rejects', async () => {
    const beforeUpload = vi.fn().mockRejectedValue(new Error('Cannot save draft'));
    const h = harness(undefined, beforeUpload);
    h.choose('app.js');
    await waitFor(() => expect(screen.getByRole('button', { name: /Upload project/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Upload project/i }));
    await waitFor(() => expect(beforeUpload).toHaveBeenCalledTimes(1));
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('ignores a late video result after replacing the project', async () => {
    const pending = deferred<string>();
    mocks.discover.mockResolvedValueOnce(new File(['video'], 'preview.mp4', { type: 'video/mp4' })).mockResolvedValueOnce(null);
    mocks.uploadVideo.mockReturnValueOnce(pending.promise);
    const h = harness();
    h.choose('old.js');
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /URL becomes public/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('checkbox', { name: /URL becomes public/i }));
    fireEvent.click(screen.getByRole('button', { name: /Upload project/i }));
    await waitFor(() => expect(mocks.uploadVideo).toHaveBeenCalledTimes(1));
    h.choose('new.js');
    pending.resolve('https://public.example/stale.mp4');
    await waitFor(() => expect(h.current?.files[0]?.path).toBe('new.js'));
    expect(h.video).not.toHaveBeenCalled();
  });

  it('ignores upload results after clearing the project', async () => {
    const pending = deferred<{ projectId: string; uploadId: string }>();
    mocks.upload.mockReturnValueOnce(pending.promise);
    const h = harness();
    h.choose('old.js');
    await waitFor(() => expect(screen.getByRole('button', { name: /Upload project/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Upload project/i }));
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Clear/i }));
    pending.resolve({ projectId: 'stale', uploadId: 'stale' });
    await waitFor(() => expect(h.current).toBeUndefined());
    expect(h.changes.at(-1)).toBeUndefined();
  });
});
