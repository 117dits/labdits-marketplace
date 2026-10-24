import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

// Execute the actual Edge handler with an in-memory Supabase/Vercel boundary;
// never connect to a deployed project or use real credentials.
const source = readFileSync(resolve(process.cwd(), 'supabase/functions/deploy-api/index.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

type DbResult = { data?: unknown; error?: { message: string } | null };
function harness(options: {
  user?: object | null;
  role?: string | null;
  product?: DbResult;
  project?: DbResult;
  upsert?: DbResult;
  vercelFileStatus?: number;
} = {}) {
  let handler!: (req: Request) => Promise<Response>;
  const upserts: unknown[] = [];
  const vercelRequests: string[] = [];
  const roleFilters: Array<[string, string]> = [];
  const db = {
    auth: { getUser: vi.fn(async (_jwt: string) => ({ data: { user: options.user === undefined ? { id: 'admin-1' } : options.user }, error: null })) },
    from: vi.fn((table: string) => ({
      select: (_columns: string) => ({
        eq: (column: string, value: string) => {
          if (table === 'user_roles') roleFilters.push([column, value]);
          return {
            eq: (roleColumn: string, roleValue: string) => {
              roleFilters.push([roleColumn, roleValue]);
              return { maybeSingle: async () => ({ data: options.role === 'user' || options.role === null ? null : { role: 'admin' }, error: null }) };
            },
            maybeSingle: async () => table === 'products' ? (options.product ?? { data: { id: 'p-1' }, error: null }) : (options.project ?? { data: null, error: null }),
          };
        },
      }),
      upsert: async (row: unknown) => { upserts.push(row); return options.upsert ?? { data: null, error: null }; },
    })),
  };
  const fakeDeno = { serve: (fn: typeof handler) => { handler = fn; }, env: { get: (key: string) => ({ VERCEL_TOKEN: 'fake-vercel-token', SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fake-service-key' })[key as 'VERCEL_TOKEN'] } };
  const fakeFetch = vi.fn(async (url: string) => {
    vercelRequests.push(url);
    return new Response('{}', { status: options.vercelFileStatus ?? 200 });
  });
  // transpileModule only changes TypeScript syntax; it does not mock the handler's logic.
  new Function('require', 'exports', 'Deno', 'fetch', compiled)(() => ({ createClient: () => db }), {}, fakeDeno, fakeFetch);
  async function upload(productId: string, token = 'valid-token') {
    const form = new FormData();
    form.append('productId', productId);
    form.append('files', new File(['hello'], 'index.html', { type: 'text/html' }));
    return handler(new Request('https://example.invalid/functions/v1/deploy-api/api/projects/upload', {
      method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form,
    }));
  }
  return { upload, handler: (req: Request) => handler(req), db, upserts, vercelRequests, roleFilters };
}

describe('deploy-api upload persistence', () => {
  it('rejects a project upsert error instead of acknowledging a nonexistent upload', async () => {
    const app = harness({ upsert: { error: { message: 'FK violation' } } });
    const response = await app.upload('p-1');
    expect(response.status).toBe(500);
    expect((await response.json()).errorMessage).toMatch(/persist|save|FK/i);
    expect(app.upserts).toHaveLength(1);
  });

  it('rejects placeholder IDs before storing any Vercel files', async () => {
    const app = harness();
    const response = await app.upload('new');
    expect(response.status).toBe(400);
    expect(app.vercelRequests).toHaveLength(0);
    expect(app.upserts).toHaveLength(0);
  });

  it('rejects unknown product IDs before storing any Vercel files', async () => {
    const app = harness({ product: { data: null, error: null } });
    const response = await app.upload('slug-instead-of-id');
    expect(response.status).toBe(404);
    expect(app.vercelRequests).toHaveLength(0);
    expect(app.upserts).toHaveLength(0);
  });

  it('rejects requests without a verified admin before using service privileges', async () => {
    const app = harness({ user: null });
    const response = await app.upload('p-1');
    expect(response.status).toBe(401);
    expect(app.vercelRequests).toHaveLength(0);
    expect(app.upserts).toHaveLength(0);
  });

  it('rejects an empty upload rather than saving an unusable project', async () => {
    const app = harness();
    const form = new FormData();
    form.append('productId', 'p-1');
    const response = await app.handler(new Request('https://example.invalid/api/projects/upload', {
      method: 'POST', headers: { Authorization: 'Bearer valid-token' }, body: form,
    }));
    expect(response.status).toBe(400);
    expect(app.upserts).toHaveLength(0);
  });

  it('rejects ZIP archives rather than persisting an unusable single blob', async () => {
    const app = harness();
    const form = new FormData();
    form.append('productId', 'p-1');
    form.append('files', new File(['PK\\x03\\x04'], 'site.zip', { type: 'application/zip' }));
    const response = await app.handler(new Request('https://example.invalid/functions/v1/deploy-api/api/projects/upload', {
      method: 'POST', headers: { Authorization: 'Bearer valid-token' }, body: form,
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).errorMessage).toMatch(/zip|archive/i);
    expect(app.vercelRequests).toHaveLength(0);
    expect(app.upserts).toHaveLength(0);
  });

  it('rejects ZIP content disguised as an HTML file', async () => {
    const app = harness();
    const form = new FormData();
    form.append('productId', 'p-1');
    form.append('files', new File(['PK\x03\x04', 'zip payload'], 'index.html', { type: 'text/html' }));
    const response = await app.handler(new Request('https://example.invalid/api/projects/upload', {
      method: 'POST', headers: { Authorization: 'Bearer valid-token' }, body: form,
    }));
    expect(response.status).toBe(400);
    expect(app.vercelRequests).toHaveLength(0);
    expect(app.upserts).toHaveLength(0);
  });

  it('rejects mixed file uploads containing a ZIP before sending the earlier files', async () => {
    const app = harness();
    const form = new FormData();
    form.append('productId', 'p-1');
    form.append('files', new File(['ok'], 'index.html'));
    form.append('files', new File(['PK\x03\x04'], 'source.zip'));
    const response = await app.handler(new Request('https://example.invalid/api/projects/upload', {
      method: 'POST', headers: { Authorization: 'Bearer valid-token' }, body: form,
    }));
    expect(response.status).toBe(400);
    expect(app.vercelRequests).toHaveLength(0);
    expect(app.upserts).toHaveLength(0);
  });

  it('checks the admin role explicitly rather than selecting an arbitrary role row', async () => {
    const app = harness();
    await app.upload('p-1');
    expect(app.roleFilters).toContainEqual(['role', 'admin']);
  });

  it('rejects a non-admin before storing any Vercel files', async () => {
    const app = harness({ role: 'user' });
    const response = await app.upload('p-1');
    expect(response.status).toBe(403);
    expect(app.vercelRequests).toHaveLength(0);
    expect(app.upserts).toHaveLength(0);
  });

  it('does not acknowledge a failed Vercel file upload', async () => {
    const app = harness({ vercelFileStatus: 503 });
    const response = await app.upload('p-1');
    expect(response.status).toBe(502);
    expect(app.upserts).toHaveLength(0);
  });

  it('rejects deploy when the project read fails rather than pretending there are no files', async () => {
    const app = harness({ project: { data: null, error: { message: 'database offline' } } });
    const response = await app.handler(new Request('https://example.invalid/api/projects/p-1/deploy', {
      method: 'POST', headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' }, body: '{}',
    }));
    expect(response.status).toBe(500);
    expect(app.vercelRequests).toHaveLength(0);
  });

  it('does not acknowledge deployment when its project update fails', async () => {
    const app = harness({ project: { data: { data: { files: [{ file: 'index.html', sha: 'abc', size: 3 }] } }, error: null }, upsert: { error: { message: 'database offline' } } });
    const response = await app.handler(new Request('https://example.invalid/api/projects/p-1/deploy', {
      method: 'POST', headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' }, body: '{}',
    }));
    expect(response.status).toBe(500);
    expect(app.vercelRequests.length).toBeGreaterThan(0);
  });

  it('does not acknowledge a deployment poll when cached status persistence fails', async () => {
    const app = harness({ project: { data: { data: { deploymentId: 'dep-1' } }, error: null }, upsert: { error: { message: 'database offline' } } });
    const response = await app.handler(new Request('https://example.invalid/api/projects/p-1/deployment', {
      headers: { Authorization: 'Bearer valid-token' },
    }));
    expect(response.status).toBe(500);
    expect(app.upserts).toHaveLength(1);
  });

  it('acknowledges an existing product only after project persistence', async () => {
    const app = harness();
    const response = await app.upload('p-1');
    expect(response.status).toBe(200);
    expect((await response.json()).projectId).toBe('p-1');
    expect(app.upserts).toHaveLength(1);
    expect(app.upserts[0]).toMatchObject({ product_id: 'p-1', data: { status: 'uploaded' } });
  });
});
