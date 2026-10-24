import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { seedProducts, seedOrders, priceFor } from '@/data/products';
import { mockService, type MarketplaceState } from '@/services/mock-service';
import { catalogConfigured, createCatalogService } from '@/services/catalog-service';
import { supabase } from '@/integrations/supabase/client';
import type { Product, License, CartItem, Order, DemoSession } from '@/types';
interface Store extends MarketplaceState { addToCart:(id:string, license?:License)=>void; updateCart:(items:CartItem[])=>void; saveProduct:(product:Product)=>void; saveProductAsync:(product:Product)=>Promise<void>; deleteProduct:(id:string)=>void; setSession:(session:DemoSession|null)=>void; placeOrder:(order:Order)=>void; saveSettings:(settings:Record<string,string>)=>void; total:number; hydrated:boolean }
const Context = createContext<Store | null>(null);
const configured = catalogConfigured();
const catalog = configured ? createCatalogService() : null;
export function MarketplaceProvider({children}:{children:ReactNode}) {
 const [state,setState] = useState<MarketplaceState>({products:seedProducts,cart:[],orders:configured?[]:seedOrders,session:null,settings:{storeName:'LABDITS',tagline:'Built to Impress. Ready to Deploy.',email:'',instagram:'',github:''}});
 const [hydrated,setHydrated]=useState(false);
 useEffect(()=>{
   let active=true;
   if (!catalog) { const stored=mockService.read(); if(stored) setState(stored); setHydrated(true); return; }
   // Seed content is SSR-safe; replace it only after hydration and a successful backend read.
   const load=async()=>{
     try {
       const [products,settings,{data:{user}}]=await Promise.all([catalog.products(),catalog.settings(),supabase.auth.getUser()]);
       const {data:roles}=user ? await supabase.from('user_roles').select('role').eq('user_id',user.id) : {data:null};
       if(active) setState(s=>({...s,products,settings,session:user?{name:user.user_metadata?.['name'] || user.email || 'User',email:user.email || '',role:roles?.some(r=>r.role==='admin')?'owner':'customer'}:null}));
     } catch { if(active) toast.error('Katalog tidak dapat diakses; menampilkan mode offline.'); }
     if(active) setHydrated(true);
   };
   void load();
   const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{setTimeout(()=>{void load();},0);});
   return ()=>{active=false;subscription.unsubscribe();};
 },[]);
 useEffect(()=>{if(hydrated && !catalog) mockService.write(state);},[state,hydrated]);
 const updateCart=(cart:CartItem[])=>setState(s=>({...s,cart}));
  const addToCart = (productId: string, license: License = 'personal') => {
    setState((s) => ({
      ...s,
      cart: s.cart.some((i) => i.productId === productId && i.license === license)
        ? s.cart
        : [...s.cart, { productId, license, quantity: 1 }],
    }));
    toast.success('Produk berhasil ditambahkan ke keranjang');
  };
 const saveProductAsync=async(p:Product)=>{if(catalog) await catalog.saveProduct(p);setState(s=>({...s,products:s.products.some(x=>x.id===p.id)?s.products.map(x=>x.id===p.id?p:x):[p,...s.products]}));};
 const saveProduct=(p:Product)=>{void saveProductAsync(p).catch(e=>toast.error(`Produk tidak tersimpan: ${e.message}`));};
 const deleteProduct=(id:string)=>{if(catalog){void catalog.deleteProduct(id).then(()=>setState(s=>({...s,products:s.products.filter(p=>p.id!==id),cart:s.cart.filter(i=>i.productId!==id)}))).catch(e=>toast.error(`Product not deleted: ${e.message}`));return;}setState(s=>({...s,products:s.products.filter(p=>p.id!==id),cart:s.cart.filter(i=>i.productId!==id)}));};
 const saveSettings=(settings:Record<string,string>)=>{if(catalog){void catalog.saveSettings(settings).then(()=>setState(s=>({...s,settings}))).catch(e=>toast.error(`Settings not saved: ${e.message}`));return;}setState(s=>({...s,settings}));};
 const value:Store={...state, hydrated,addToCart,updateCart,saveProduct,saveProductAsync,deleteProduct,setSession:session=>{if(catalog){if(!session) void supabase.auth.signOut();return;}setState(s=>({...s,session}));},placeOrder:order=>setState(s=>({...s,orders:[order,...s.orders],cart:[]})),saveSettings,total:state.cart.reduce((sum,i)=>{const p=state.products.find(p=>p.id===i.productId);return sum+(p?priceFor(p,i.license)*i.quantity:0)},0)};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useMarketplace(){const store=useContext(Context);if(!store)throw new Error('MarketplaceProvider is required');return store;}
