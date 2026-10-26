import { useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import './product-card-video.css';

function HoverPreview({ url, poster, name, active, video }: { url: string; poster: string; name: string; active: boolean; video: React.RefObject<HTMLVideoElement | null> }) {
  return <video ref={video} className="product-hover-video" src={active ? url : undefined}
    poster={poster} muted loop playsInline autoPlay preload="none" aria-label={`Video pratinjau ${name}`} />;
}
import { ArrowUpRight, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { money } from '@/data/products';
import type { Product } from '@/types';
export function ProductCard({product:p}:{product:Product}) {
 const [active,setActive]=useState(false);
 const video=useRef<HTMLVideoElement>(null);
 let url: string | undefined;
 try {
  if (p.previewVideoUrl) {
    if (p.previewVideoUrl.startsWith('/') && !p.previewVideoUrl.startsWith('//')) {
      url = p.previewVideoUrl;
    } else {
      const parsed = new URL(p.previewVideoUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'blob:') url = p.previewVideoUrl;
    }
  }
 } catch { /* invalid URL */ }
 const stop=()=>{ video.current?.pause(); setActive(false); };
 return <article className={`product-card theme-${p.theme}`}><Link to="/products/$slug" params={{slug:p.slug}} className="product-preview block" aria-label={`Lihat ${p.name}`} onMouseEnter={()=>{if(url)setActive(true)}} onMouseLeave={stop} onFocus={()=>{if(url)setActive(true)}} onBlur={stop}><img src={p.image} alt={`Pratinjau aplikasi ${p.name}`} loading="lazy" width={1536} height={1024}/>{url&&<HoverPreview url={url} poster={p.image} name={p.name} active={active} video={video} />}{p.featured&&<span className="preview-badge"><Sparkles/>{p.popularity>80?'POPULAR':'PREMIUM'}</span>}</Link><div className="product-body"><span className="product-category">{p.category}</span><Link to="/products/$slug" params={{slug:p.slug}}><h3>{p.name}<span className="text-muted-foreground"> ↗</span></h3></Link><p>{p.subtitle}</p><div className="stack-tags">{p.stack.slice(0,3).map(s=><span key={s}>{s}</span>)}</div><div className="product-card-bottom"><div><span className="starting">Mulai dari</span><strong>{money(p.price)}</strong></div><div className="card-actions flex gap-1"><Button variant="outline" size="sm" asChild><Link to="/$productSlug" params={{productSlug:p.slug}}><Play/>Demo Langsung</Link></Button><Button variant="ghost" size="sm" asChild><Link to="/products/$slug" params={{slug:p.slug}}>Detail<ArrowUpRight/></Link></Button></div></div></div></article>
}
