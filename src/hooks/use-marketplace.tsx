import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { seedProducts, seedOrders, priceFor } from '@/data/products';
import { mockService, type MarketplaceState } from '@/services/mock-service';
import type { Product, License, CartItem, Order, DemoSession } from '@/types';
interface Store extends MarketplaceState { addToCart:(id:string, license?:License)=>void; updateCart:(items:CartItem[])=>void; saveProduct:(product:Product)=>void; deleteProduct:(id:string)=>void; setSession:(session:DemoSession|null)=>void; placeOrder:(order:Order)=>void; saveSettings:(settings:Record<string,string>)=>void; total:number; hydrated:boolean }
const Context = createContext<Store | null>(null);
export function MarketplaceProvider({children}:{children:ReactNode}) {
 const [state,setState] = useState<MarketplaceState>({products:seedProducts,cart:[],orders:seedOrders,session:null,settings:{storeName:'LABDITS',tagline:'Built to Impress. Ready to Deploy.',email:'',instagram:'',github:''}});
 const [hydrated,setHydrated]=useState(false);
 useEffect(()=>{const stored=mockService.read(); if(stored) setState(stored); setHydrated(true);},[]);
 useEffect(()=>{if(hydrated) mockService.write(state);},[state,hydrated]);
 const updateCart=(cart:CartItem[])=>setState(s=>({...s,cart}));
 const addToCart=(productId:string,license:License='personal')=>{setState(s=>({...s,cart:s.cart.some(i=>i.productId===productId&&i.license===license)?s.cart:[...s.cart,{productId,license,quantity:1}]}));toast.success('Added to your cart');};
 const saveProduct=(p:Product)=>{setState(s=>({...s,products:s.products.some(x=>x.id===p.id)?s.products.map(x=>x.id===p.id?p:x):[p,...s.products]}));};
 const value:Store={...state, hydrated,addToCart,updateCart,saveProduct,deleteProduct:id=>setState(s=>({...s,products:s.products.filter(p=>p.id!==id),cart:s.cart.filter(i=>i.productId!==id)})),setSession:session=>setState(s=>({...s,session})),placeOrder:order=>setState(s=>({...s,orders:[order,...s.orders],cart:[]})),saveSettings:settings=>setState(s=>({...s,settings})),total:state.cart.reduce((sum,i)=>{const p=state.products.find(p=>p.id===i.productId);return sum+(p?priceFor(p,i.license)*i.quantity:0)},0)};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useMarketplace(){const store=useContext(Context);if(!store)throw new Error('MarketplaceProvider is required');return store;}
