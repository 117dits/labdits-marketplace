import { describe, it, expect } from 'vitest';
import { analyzeProject, inspectEntries } from '@/lib/project-analyzer';
import { isDeploymentLive } from '@/types';
import { mockService } from '@/services/mock-service';
const e = (path: string, body?: string) => ({ path, size: 10, read: body ? async () => body : undefined });
describe('project analyzer', () => {
  it('detects React + Vite TypeScript with npm', async () => {
    const a = await analyzeProject([e('package.json', JSON.stringify({ name: 'financeflow', scripts: { build: 'vite build' }, dependencies: { react: '1' }, devDependencies: { vite: '5', typescript: '5' } })), e('package-lock.json'), e('src/main.tsx')], 'x');
    expect([a.framework, a.language, a.packageManager, a.buildCommand, a.outputDirectory, a.compatibility]).toEqual(['React + Vite', 'TypeScript', 'npm', 'npm run build', 'dist', 'supported']);
  });
  it('never invents a build command without a build script', async () => {
    const a = await analyzeProject([e('package.json', JSON.stringify({ dependencies: { react: '1', vite: '5' } }))], 'x');
    expect(a.buildCommand).toBeNull(); expect(a.compatibility).toBe('configuration_required');
  });
  it('flags Laravel as unsupported runtime', async () => {
    expect((await analyzeProject([e('artisan'), e('composer.json', '{}')], 'x')).compatibility).toBe('unsupported');
  });
  it('rejects ZIP path traversal', () => { expect(inspectEntries([e('../evil.sh'), e('index.html')]).problems.length).toBe(1); });
  it('accepts project files above the former 100 MB per-file limit', () => {
    const size = 2 * 1024 * 1024 * 1024;
    const result = inspectEntries([{ path: 'assets/video.mp4', size }]);
    expect(result.problems).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.totalSize).toBe(size);
  });
  it('accepts projects above the former 500 MB total limit', () => {
    const size = 90 * 1024 * 1024;
    const result = inspectEntries(Array.from({ length: 10 }, (_, i) => ({ path: `asset-${i}.bin`, size })));
    expect(result.problems).toEqual([]);
    expect(result.totalSize).toBe(900 * 1024 * 1024);
  });
  it('does not reject large files in the mock upload adapter', async () => {
    const file = new File([], 'large.zip');
    Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 * 1024 });
    expect(await mockService.validateProjectFiles([file])).toEqual([{ name: 'large.zip', valid: true, reason: 'Ready for simulated upload' }]);
  });
  it('demo is live only with verified https preview', () => {
    const base = { projectId: 'p', deploymentId: 'd', status: 'ready' as const, stage: 9, detectedFramework: null, detectedLanguage: null, buildCommand: null, outputDirectory: null, errorMessage: null, createdAt: '', updatedAt: '' };
    expect(isDeploymentLive({ ...base, previewUrl: 'https://a.demo', verified: false })).toBe(false);
    expect(isDeploymentLive({ ...base, previewUrl: 'https://a.demo', verified: true })).toBe(true);
  });
});
