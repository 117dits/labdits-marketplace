import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryHistory, RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router';
import { DemoViewer } from '@/components/demo/demo-viewer';
import type { Product } from '@/types';

const mockUseMarketplace = vi.fn();
vi.mock('@/hooks/use-marketplace', () => ({
  useMarketplace: () => mockUseMarketplace(),
}));

function renderDemoViewer(slug: string) {
  const root = createRootRoute({ component: () => <DemoViewer slug={slug} /> });
  const productsRoute = createRoute({ getParentRoute: () => root, path: 'products' });
  const homeRoute = createRoute({ getParentRoute: () => root, path: '/' });
  const checkoutRoute = createRoute({ getParentRoute: () => root, path: 'checkout' });
  const productDetailRoute = createRoute({ getParentRoute: () => root, path: 'products/$slug' });
  const router = createRouter({
    routeTree: root.addChildren([productsRoute, homeRoute, checkoutRoute, productDetailRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  return render(<RouterProvider router={router} />);
}

describe('DemoViewer', () => {
  it('shows loading state when catalog is not yet hydrated', async () => {
    mockUseMarketplace.mockReturnValue({
      products: [],
      addToCart: vi.fn(),
      session: null,
      hydrated: false,
    });

    renderDemoViewer('coffer');
    expect(await screen.findByText(/Memuat Live Demo/i)).toBeInTheDocument();
    expect(screen.queryByText(/Demo unavailable/i)).not.toBeInTheDocument();
  });

  it('matches slug case-insensitively and renders the live preview', async () => {
    const cofferProduct: Product = {
      id: '4',
      slug: 'Coffer',
      name: 'Coffer',
      subtitle: 'Modern Accounting',
      category: 'Fintech',
      description: 'Test description',
      stack: ['React', 'TypeScript'],
      features: ['Finance'],
      price: 150000,
      commercialPrice: 300000,
      installationPrice: 50000,
      image: '/coffer.png',
      theme: 'mint',
      featured: true,
      status: 'published',
      popularity: 90,
      version: '1.0.0',
      updated: '2026-10-20',
      project: {
        sourceType: 'zip',
        files: [],
        totalSize: 100,
        uploadId: 'up-1',
        localStatus: 'ready',
        deployment: {
          projectId: '4',
          deploymentId: 'dpl_123',
          status: 'ready',
          stage: 10,
          previewUrl: 'https://labdits-4-kvu8mmuij-dits-devops-projects.vercel.app',
          verified: true,
          embeddable: true,
          createdAt: '',
          updatedAt: '',
          errorMessage: null,
          detectedFramework: 'vite',
          detectedLanguage: 'TypeScript',
          buildCommand: 'npm run build',
          outputDirectory: 'dist',
        },
      },
    };

    mockUseMarketplace.mockReturnValue({
      products: [cofferProduct],
      addToCart: vi.fn(),
      session: null,
      hydrated: true,
    });

    // Lowercase slug requested while product in DB has capital "Coffer"
    renderDemoViewer('coffer');
    expect(await screen.findByTitle(/Coffer live demo/i)).toBeInTheDocument();
    expect(screen.queryByText(/Demo unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Demo Tidak Tersedia/i)).not.toBeInTheDocument();
  });

  it('matches by product id when accessed by id param', async () => {
    const cofferProduct: Product = {
      id: '4',
      slug: 'Coffer',
      name: 'Coffer',
      subtitle: 'Modern Accounting',
      category: 'Fintech',
      description: 'Test description',
      stack: ['React', 'TypeScript'],
      features: ['Finance'],
      price: 150000,
      commercialPrice: 300000,
      installationPrice: 50000,
      image: '/coffer.png',
      theme: 'mint',
      featured: true,
      status: 'published',
      popularity: 90,
      version: '1.0.0',
      updated: '2026-10-20',
      demoUrl: 'https://demo.example.com/coffer',
    };

    mockUseMarketplace.mockReturnValue({
      products: [cofferProduct],
      addToCart: vi.fn(),
      session: null,
      hydrated: true,
    });

    renderDemoViewer('4');
    expect(await screen.findByTitle(/Coffer live demo/i)).toBeInTheDocument();
  });

  it('displays friendly Indonesian state when demo is not found', async () => {
    mockUseMarketplace.mockReturnValue({
      products: [],
      addToCart: vi.fn(),
      session: null,
      hydrated: true,
    });

    renderDemoViewer('aplikasi-tidak-ada');
    expect(await screen.findByText('Demo Tidak Tersedia')).toBeInTheDocument();
    expect(screen.getByText(/Aplikasi demo dengan tautan “aplikasi-tidak-ada” tidak ditemukan/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kembali ke Etalase/i })).toBeInTheDocument();
  });
});
