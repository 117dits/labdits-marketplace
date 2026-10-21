import type { BuildConfig, ProjectAnalysis } from '@/types/deployment';

/** Vercel manages Next.js output internally; .next is not a static output override. */
export function prepareDeploymentConfig(
  analysis: ProjectAnalysis | undefined,
  current: BuildConfig,
): { config: BuildConfig; error: string | null } {
  const framework = analysis?.framework;
  const config = { ...current };
  if (!config.buildCommand.trim() && analysis?.buildCommand) config.buildCommand = analysis.buildCommand;
  if (framework === 'Next.js') {
    config.outputDirectory = '';
  } else if (!config.outputDirectory.trim() && analysis?.outputDirectory) {
    config.outputDirectory = analysis.outputDirectory;
  }
  if (framework !== 'Static HTML' && !config.buildCommand.trim()) {
    return { config, error: 'Set a build command first.' };
  }
  if (framework !== 'Static HTML' && framework !== 'Next.js' && !config.outputDirectory.trim()) {
    return { config, error: 'Set an output directory first.' };
  }
  return { config, error: null };
}
