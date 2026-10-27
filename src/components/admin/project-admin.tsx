import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ScrollText, Rocket, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMarketplace } from '@/hooks/use-marketplace';
import { deploymentService } from '@/services/deployment-service';
import { currentStatus, statusClass, statusLabel } from '@/components/admin/project-uploader';
import { isDeploymentLive, type LogLine, type Product } from '@/types';

export function ProjectCells({ product: p }: { product: Product }) {
  const pr = p.project, d = pr?.deployment, s = currentStatus(pr), live = isDeploymentLive(d);
  return <>
    <td className="text-xs">{pr?.analysis?.framework ?? (pr ? 'Belum dianalisis' : <span className="text-muted-foreground">Belum ada unggahan</span>)}</td>
    <td>{pr ? <span className={`status ${statusClass(s)}`}>{statusLabel[s]}</span> : <span className="text-xs text-muted-foreground">—</span>}</td>
    <td className="text-xs">{pr ? (live ? 'Tayang (Live)' : 'Belum tayang') : p.demoUrl ? 'URL Eksternal' : 'Demo Interaktif'}</td>
    <td className="max-w-40 truncate font-mono text-[10px]">{live ? <a href={d.previewUrl} target="_blank" rel="noreferrer" className="text-primary underline">{d.previewUrl}</a> : '—'}</td>
    <td className="text-xs text-muted-foreground">{d?.updatedAt?.slice(0, 16).replace('T', ' ') ?? '—'}</td>
  </>;
}

export function ProjectActions({ product: p }: { product: Product }) {
  const store = useMarketplace(); const [logs, setLogs] = useState<LogLine[] | null>(null);
  const pr = p.project, id = pr?.projectId;
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Permintaan gagal');
  return <>
    {pr && <Button variant="ghost" size="icon" title="Lihat log build" aria-label={`Lihat log build untuk ${p.name}`} onClick={async () => { if (!id) { toast.error('Unggah proyek terlebih dahulu.'); return; } try { setLogs((await deploymentService.getLogs(id)).lines); } catch (e) { fail(e); } }}><ScrollText /></Button>}
    {pr && <Button variant="ghost" size="icon" title={pr.deployment?.status === 'failed' ? 'Coba deploy ulang' : 'Deploy live demo'} aria-label={`Deploy live demo untuk ${p.name}`} onClick={async () => { if (!id || !pr.buildConfig) { toast.error('Unggah dan konfigurasikan proyek terlebih dahulu.'); return; } try { store.saveProduct({ ...p, project: { ...pr, deployment: await deploymentService.deploy(id, pr.buildConfig) } }); toast.success('Proses deployment dimulai'); } catch (e) { fail(e); } }}><Rocket /></Button>}
    <Button variant="ghost" size="icon" asChild><Link to="/$productSlug" params={{ productSlug: p.slug }} title="Buka demo" aria-label={`Buka demo untuk ${p.name}`}><ExternalLink /></Link></Button>
    {logs && <div className="modal-backdrop" onClick={() => setLogs(null)}><div className="modal" role="dialog" aria-modal="true" aria-label="Log build" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>Log build · {p.name}</h2><Button variant="ghost" size="icon" aria-label="Tutup log" onClick={() => setLogs(null)}><X /></Button></div><pre className="max-h-96 overflow-auto whitespace-pre-wrap font-mono text-[11px]">{logs.length ? logs.map(l => `[${l.timestamp}] ${l.level.toUpperCase()} ${l.message}`).join('\n') : 'Belum ada baris log tercatat.'}</pre></div></div>}
  </>;
}
