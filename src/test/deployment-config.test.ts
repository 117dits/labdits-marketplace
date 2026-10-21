import { describe, expect, it } from 'vitest';
import { prepareDeploymentConfig } from '@/lib/deployment-config';
import type { BuildConfig, ProjectAnalysis } from '@/types/deployment';

const config: BuildConfig = {
  installCommand: 'npm ci', buildCommand: 'npm run build', outputDirectory: '',
  nodeVersion: '20', envNotes: '',
};
const analysis = { framework: 'Next.js', outputDirectory: '.next', buildCommand: 'npm run build' } as ProjectAnalysis;

describe('deployment config', () => {
  it('allows a Next.js deployment without an explicit output directory', () => {
    expect(prepareDeploymentConfig(analysis, config)).toEqual({
      config: { ...config, outputDirectory: '' }, error: null,
    });
  });
  it('does not bypass missing build settings for unrecognized frameworks', () => {
    expect(prepareDeploymentConfig({ ...analysis, framework: 'Unknown', outputDirectory: null, buildCommand: null }, { ...config, buildCommand: '' }).error)
      .toMatch(/build command/i);
  });
});
