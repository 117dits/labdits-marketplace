// Contracts shared by the project uploader, deployment UI, demo viewer and the future backend.

export type DeploymentStatus =
  | 'pending'
  | 'uploading'
  | 'analyzing'
  | 'building'
  | 'deploying'
  | 'ready'
  | 'failed'
  | 'configuration_required'
  | 'backend_required';

/** Ordered pipeline stages. Indices are shared with the backend `stage` field. */
export const DEPLOYMENT_STAGES = [
  'Files Selected',
  'Project Validated',
  'Uploaded to Storage',
  'Framework Detected',
  'Waiting for Build',
  'Installing Dependencies',
  'Building Application',
  'Deploying Preview',
  'Health Check',
  'Live Demo Ready',
] as const;
export type DeploymentStage = (typeof DEPLOYMENT_STAGES)[number];

export type Compatibility = 'supported' | 'configuration_required' | 'unsupported';
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'none' | 'unknown';

export interface ProjectFileEntry { path: string; size: number }

export interface ProjectAnalysis {
  projectName: string;
  framework: string;
  language: string;
  styling: string[];
  packageManager: PackageManager;
  /** null = not detected confidently; admin must configure manually. */
  buildCommand: string | null;
  installCommand: string | null;
  outputDirectory: string | null;
  needsServerRuntime: boolean;
  envRequired: boolean;
  envKeys: string[];
  compatibility: Compatibility;
  keyFiles: string[];
  notes: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface BuildConfig { installCommand: string; buildCommand: string; outputDirectory: string; nodeVersion: string; envNotes: string }

/** Shape the backend must return from GET /api/projects/:id/deployment */
export interface DeploymentResponse {
  projectId: string;
  deploymentId: string;
  status: DeploymentStatus;
  /** Index into DEPLOYMENT_STAGES */
  stage: number;
  detectedFramework: string | null;
  detectedLanguage: string | null;
  buildCommand: string | null;
  outputDirectory: string | null;
  previewUrl: string | null;
  /** true only after the backend health check verified the preview URL */
  verified: boolean;
  /** whether the deployed app allows being framed by the LABDITS origin */
  embeddable?: boolean;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadResponse { projectId: string; uploadId: string; fileCount: number; totalSize: number }
export interface AnalyzeResponse { projectId: string; analysis: ProjectAnalysis }
export interface LogLine { timestamp: string; level: 'info' | 'warn' | 'error'; message: string }
export interface LogsResponse { projectId: string; deploymentId: string | null; lines: LogLine[] }
export interface PreviewResponse { projectId: string; previewUrl: string | null; verified: boolean; embeddable: boolean }
export interface PublishResponse { projectId: string; published: boolean; errorMessage: string | null }

/** Persisted project record attached to a Product (File objects are never persisted). */
export interface ProjectRecord {
  projectId?: string;
  uploadId?: string;
  sourceType: 'zip' | 'folder' | 'files';
  files: ProjectFileEntry[];
  totalSize: number;
  analysis?: ProjectAnalysis;
  buildConfig?: BuildConfig;
  deployment?: DeploymentResponse;
  /** Local-only status used before the backend takes over. */
  localStatus: DeploymentStatus;
  localMessage?: string;
}

export function isDeploymentLive(d?: DeploymentResponse | null): d is DeploymentResponse & { previewUrl: string } {
  return !!d && d.status === 'ready' && d.verified === true && typeof d.previewUrl === 'string' && /^https:\/\//.test(d.previewUrl);
}
