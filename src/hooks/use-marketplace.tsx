import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { seedProducts, seedOrders, priceFor } from '@/data/products';
import { mockService, type MarketplaceState } from '@/services/mock-service';
import { catalogConfigured, createCatalogService } from '@/services/catalog-service';
import { supabase } from '@/integrations/supabase/client';
import type { Product, License, CartItem, Order, DemoSession } from '@/types';
interface Store extends MarketplaceState {
  addToCart: (id: string, license?: License) => void;
  updateCart: (items: CartItem[]) => void;
  saveProduct: (product: Product) => void;
  saveProductAsync: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => void;
  setSession: (session: DemoSession | null) => void;
  placeOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: 'Paid' | 'Pending' | 'Cancelled') => void;
  deleteOrder: (orderId: string) => void;
  clearOrders: () => void;
  saveSettings: (settings: Record<string, string>) => void;
  total: number;
  hydrated: boolean;
}
const Context = createContext<Store | null>(null);
const configured = catalogConfigured();
const catalog = configured ? createCatalogService() : null;
const readInitialCart = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('labdits_cart');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const readInitialSession = (): DemoSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('labdits_customer_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
export function MarketplaceProvider({children}:{children:ReactNode}) {
 const [state,setState] = useState<MarketplaceState>({products:seedProducts,cart:readInitialCart(),orders:configured?[]:seedOrders,session:readInitialSession(),settings:{storeName:'LABDITS',tagline:'Built to Impress. Ready to Deploy.',email:'',instagram:'',github:'',payment_mode:'manual',admin_whatsapp:'085882846665',qris_nmid:'ID1026491254490',qris_merchant:'DITSSTORE - SOFTWARE',bank_name:'SeaBank',bank_account_number:'9014 7615 4832',bank_account_name:'Muhammad Raditya Anwar'}});
 const [hydrated,setHydrated]=useState(false);
 useEffect(()=>{
   let active=true;
   if (!catalog) { const stored=mockService.read(); if(stored) setState(stored); setHydrated(true); return; }
   const load=async()=>{
     try {
       const [products,settings,{data:{user}}]=await Promise.all([catalog.products(),catalog.settings(),supabase.auth.getUser()]);
       const {data:roles}=user ? await supabase.from('user_roles').select('role').eq('user_id',user.id) : {data:null};
       let remoteOrders: Order[] = [];
       if (settings['orders']) {
         try {
           remoteOrders = typeof settings['orders'] === 'string' ? JSON.parse(settings['orders']) : (settings['orders'] as unknown as Order[]);
         } catch {}
       }
       let localOrders: Order[] = [];
       try {
         const raw = localStorage.getItem('labdits_orders');
         if (raw) localOrders = JSON.parse(raw);
       } catch {}
       const orderMap = new Map<string, Order>();
       [...localOrders, ...remoteOrders].forEach((o) => {
         if (o && o.id) orderMap.set(o.id, o);
       });
       const mergedOrders = Array.from(orderMap.values());

       let customerSession: DemoSession | null = null;
       try {
         const rawCust = localStorage.getItem('labdits_customer_session');
         if (rawCust) customerSession = JSON.parse(rawCust);
       } catch {}

       const activeSession: DemoSession | null = user
         ? { name: user.user_metadata?.['name'] || user.email || 'User', email: user.email || '', role: roles?.some(r => r.role === 'admin') ? 'owner' : 'customer' }
         : customerSession;

       if(active) setState(s=>({...s,products,settings:{...s.settings,...settings},orders:mergedOrders,session:activeSession}));
     } catch { if(active) toast.error('Katalog tidak dapat diakses; menampilkan mode offline.'); }
     if(active) setHydrated(true);
   };
   void load();
   const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{setTimeout(()=>{void load();},0);});

   const interval = setInterval(() => {
     if (catalog && typeof document !== 'undefined' && document.visibilityState === 'visible') {
       void catalog.settings().then((remote) => {
         if (remote['orders'] && active) {
           try {
             const parsed: Order[] = typeof remote['orders'] === 'string' ? JSON.parse(remote['orders']) : (remote['orders'] as unknown as Order[]);
             setState((s) => {
               const map = new Map<string, Order>();
               s.orders.forEach((o) => map.set(o.id, o));
               let changed = false;
               parsed.forEach((o) => {
                 const existing = map.get(o.id);
                 if (existing && existing.status === 'Pending' && o.status === 'Paid') {
                   if (!s.session || s.session.email === o.customer.email) {
                     toast.success(`Pesanan #${o.id} telah disetujui (Acc) oleh Admin DITSSTORE! Akses unduhan source code sekarang aktif.`, {
                       duration: 10000,
                       action: {
                         label: 'Buka Unduhan',
                         onClick: () => { window.location.href = '/account/downloads'; },
                       },
                     });
                   }
                 }
                 if (!existing || existing.status !== o.status) {
                   map.set(o.id, o);
                   changed = true;
                 }
               });
               if (changed) {
                 const updated = Array.from(map.values());
                 try {
                   localStorage.setItem('labdits_orders', JSON.stringify(updated));
                 } catch {}
                 return { ...s, orders: updated };
               }
               return s;
             });
           } catch {}
         }
       });
     }
   }, 5000);

   // Listen for instant order updates across tabs via BroadcastChannel & storage events
   let bc: BroadcastChannel | null = null;
   if (typeof BroadcastChannel !== 'undefined') {
     try {
       bc = new BroadcastChannel('labdits_order_channel');
       bc.onmessage = (event) => {
         if (event.data?.type === 'ORDERS_UPDATED' && Array.isArray(event.data.orders)) {
           const incoming: Order[] = event.data.orders;
           setState((s) => {
             const map = new Map<string, Order>();
             s.orders.forEach((o) => map.set(o.id, o));
             incoming.forEach((o) => {
               const existing = map.get(o.id);
               if (existing && existing.status === 'Pending' && o.status === 'Paid') {
                 if (!s.session || s.session.email === o.customer.email) {
                   toast.success(`Pesanan #${o.id} telah disetujui (Acc) oleh Admin DITSSTORE! Akses unduhan source code sekarang aktif.`, {
                     duration: 10000,
                     action: {
                       label: 'Buka Unduhan',
                       onClick: () => { window.location.href = '/account/downloads'; },
                     },
                   });
                 }
               }
               map.set(o.id, o);
             });
             return { ...s, orders: Array.from(map.values()) };
           });
         }
       };
     } catch {}
   }

   const handleStorage = (e: StorageEvent) => {
     if (e.key === 'labdits_orders' && e.newValue) {
       try {
         const incoming: Order[] = JSON.parse(e.newValue);
         setState((s) => {
           const map = new Map<string, Order>();
           s.orders.forEach((o) => map.set(o.id, o));
           incoming.forEach((o) => {
             const existing = map.get(o.id);
             if (existing && existing.status === 'Pending' && o.status === 'Paid') {
               if (!s.session || s.session.email === o.customer.email) {
                 toast.success(`Pesanan #${o.id} telah disetujui (Acc) oleh Admin DITSSTORE! Akses unduhan source code sekarang aktif.`, {
                   duration: 10000,
                   action: {
                     label: 'Buka Unduhan',
                     onClick: () => { window.location.href = '/account/downloads'; },
                   },
                 });
               }
             }
             map.set(o.id, o);
           });
           return { ...s, orders: Array.from(map.values()) };
         });
       } catch {}
     }
   };
   window.addEventListener('storage', handleStorage);

   return () => {
     active = false;
     clearInterval(interval);
     subscription.unsubscribe();
     if (bc) bc.close();
     window.removeEventListener('storage', handleStorage);
   };
 },[]);
 useEffect(()=>{if(hydrated && !catalog) mockService.write(state);},[state,hydrated]);
 const updateCart = (cart: CartItem[]) => {
   try { localStorage.setItem('labdits_cart', JSON.stringify(cart)); } catch {}
   setState(s => ({ ...s, cart }));
 };
 const addToCart = (productId: string, license: License = 'personal') => {
   setState((s) => {
     const nextCart = s.cart.some((i) => i.productId === productId && i.license === license)
       ? s.cart
       : [...s.cart, { productId, license, quantity: 1 }];
     try { localStorage.setItem('labdits_cart', JSON.stringify(nextCart)); } catch {}
     return { ...s, cart: nextCart };
   });
   toast.success('Produk berhasil ditambahkan ke keranjang');
 };
 const saveProductAsync=async(p:Product)=>{if(catalog) await catalog.saveProduct(p);setState(s=>({...s,products:s.products.some(x=>x.id===p.id)?s.products.map(x=>x.id===p.id?p:x):[p,...s.products]}));};
 const saveProduct=(p:Product)=>{void saveProductAsync(p).catch(e=>toast.error(`Produk tidak tersimpan: ${e.message}`));};
 const deleteProduct=(id:string)=>{if(catalog){void catalog.deleteProduct(id).then(()=>setState(s=>({...s,products:s.products.filter(p=>p.id!==id),cart:s.cart.filter(i=>i.productId!==id)}))).catch(e=>toast.error(`Produk gagal dihapus: ${e.message}`));return;}setState(s=>({...s,products:s.products.filter(p=>p.id!==id),cart:s.cart.filter(i=>i.productId!==id)}));};

 const persistOrders = (orders: Order[], currentSettings: Record<string, string>) => {
   try {
     localStorage.setItem('labdits_orders', JSON.stringify(orders));
     if (typeof BroadcastChannel !== 'undefined') {
       const bc = new BroadcastChannel('labdits_order_channel');
       bc.postMessage({ type: 'ORDERS_UPDATED', orders });
       bc.close();
     }
   } catch {}
   if (catalog) {
     const updatedSettings = { ...currentSettings, orders: JSON.stringify(orders) };
     void catalog.saveSettings(updatedSettings).catch(() => {});
   }
 };

 const placeOrder = (order: Order) => {
   setState((s) => {
     const updated = [order, ...s.orders.filter((o) => o.id !== order.id)];
     persistOrders(updated, s.settings);
     try { localStorage.removeItem('labdits_cart'); } catch {}
     return { ...s, orders: updated, cart: [] };
   });
 };

 const updateOrderStatus = (orderId: string, status: 'Paid' | 'Pending' | 'Cancelled') => {
   setState((s) => {
     const updated = s.orders.map((o) => (o.id === orderId ? { ...o, status } : o));
     persistOrders(updated, s.settings);
     return { ...s, orders: updated };
   });
 };

 const deleteOrder = (orderId: string) => {
   setState((s) => {
     const updated = s.orders.filter((o) => o.id !== orderId);
     persistOrders(updated, s.settings);
     return { ...s, orders: updated };
   });
 };

 const clearOrders = () => {
   setState((s) => {
     persistOrders([], s.settings);
     return { ...s, orders: [] };
   });
 };

 const setSession = (session: DemoSession | null) => {
   if (!session) {
     try { localStorage.removeItem('labdits_customer_session'); } catch {}
     if (catalog) void supabase.auth.signOut();
   } else {
     try { localStorage.setItem('labdits_customer_session', JSON.stringify(session)); } catch {}
   }
   setState(s => ({ ...s, session }));
 };
 const saveSettings=(settings:Record<string,string>)=>{if(catalog){void catalog.saveSettings(settings).then(()=>setState(s=>({...s,settings}))).catch(e=>toast.error(`Pengaturan gagal disimpan: ${e.message}`));return;}setState(s=>({...s,settings}));};
 const value:Store={...state, hydrated,addToCart,updateCart,saveProduct,saveProductAsync,deleteProduct,setSession,placeOrder,updateOrderStatus,deleteOrder,clearOrders,saveSettings,total:state.cart.reduce((sum,i)=>{const p=state.products.find(p=>p.id===i.productId);return sum+(p?priceFor(p,i.license)*i.quantity:0)},0)};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useMarketplace(){const store=useContext(Context);if(!store)throw new Error('MarketplaceProvider is required');return store;}
