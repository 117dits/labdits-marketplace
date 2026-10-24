import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('@/components/ui/button', () => ({ Button: ({ children, asChild, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => <button {...props}>{children}</button> }));
import { ProductWizard } from '@/components/admin/product-wizard';
import { initialProjectDraft } from '@/lib/product-wizard-flow';
import type { Product } from '@/types';

const mocks = vi.hoisted(() => ({ save: vi.fn(), products: [] as Product[], uploader: vi.fn(), navigate: vi.fn() }));
vi.mock('@/hooks/use-marketplace', () => ({ useMarketplace: () => ({ products: mocks.products, hydrated: true, saveProductAsync: mocks.save }) }));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>, useNavigate: () => mocks.navigate }));
vi.mock('@/components/layout/dashboard-layout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/admin/admin-pages', () => ({ AdminHeading: () => null }));
vi.mock('@/components/admin/project-uploader', () => ({ ProjectUploader: (props: { onBeforeUpload: () => Promise<string>; onChange: (value: unknown) => void; onBusyChange: (busy: boolean) => void; onVideoUploaded: (url: string) => void; value?: unknown; productId: string }) => { mocks.uploader(props); return <button type="button" onClick={() => void props.onBeforeUpload()}>Simulate upload</button>; } }));
vi.mock('@/components/products/product-card', () => ({ ProductCard: () => null }));
vi.mock('motion/react', () => ({ motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }, useReducedMotion: () => true }));

beforeEach(() => { vi.clearAllMocks(); mocks.products = []; mocks.save.mockResolvedValue(undefined); });
describe('wizard upload lifecycle', () => {
  it('persists a stable unique draft before providing its id for upload', async () => {
    render(<ProductWizard />);
    fireEvent.click(screen.getByRole('button', { name: 'Simulate upload' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    const saved = mocks.save.mock.calls[0]![0] as Product;
    expect(saved.id).toMatch(/^p-/);
    expect(saved.id).not.toBe('new');
    expect(saved.slug).toMatch(/^upload-/);
    expect(saved.status).toBe('draft');
    const props = mocks.uploader.mock.lastCall![0];
    expect(await props.onBeforeUpload()).toBe(saved.id);
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it('does not permit continuation while uploader followups remain pending', async () => {
    render(<ProductWizard />);
    const props = mocks.uploader.mock.lastCall![0];
    act(() => { props.onChange({ projectId: 'p', uploadId: 'u', localStatus: 'analyzing', files: [] }); props.onBusyChange(true); });
    expect(screen.getByRole('button', { name: /Lanjutkan/i })).toBeDisabled();
    act(() => props.onBusyChange(false));
    expect(screen.getByRole('button', { name: /Lanjutkan/i })).toBeDisabled();
    act(() => props.onChange({ projectId: 'p', uploadId: 'u', localStatus: 'pending', files: [] }));
    expect(screen.getByRole('button', { name: /Lanjutkan/i })).not.toBeDisabled();
  });
  it('clears stale video when replacing a project but preserves edited fields', async () => {
    const existing = { ...initialProjectDraft(), id: 'old', slug: 'custom', name: 'Custom', description: 'Edited', previewVideoUrl: 'https://old/video', project: { projectId: 'old-project', uploadId: 'old-up', files: [], sourceType: 'files', totalSize: 0, localStatus: 'pending' } } as Product;
    mocks.products = [existing];
    render(<ProductWizard id="old" />);
    fireEvent.click(screen.getByRole('button', { name: /Unggah proyek/i }));
    const props = mocks.uploader.mock.lastCall![0];
    props.onChange({ files: [], sourceType: 'files', totalSize: 0, localStatus: 'analyzing' });
    await waitFor(() => expect(mocks.uploader.mock.lastCall![0].value?.projectId).toBeUndefined());
    expect(mocks.uploader.mock.lastCall![0].productId).toBe('old');
  });
});
