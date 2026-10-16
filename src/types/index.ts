import type { ProjectRecord } from './deployment';
export type License = 'personal' | 'commercial' | 'installation';
export interface Product { id: string; slug: string; name: string; subtitle: string; category: string; description: string; stack: string[]; features: string[]; price: number; commercialPrice: number; installationPrice: number; discountPrice?: number; image: string; theme: string; featured: boolean; status: 'published' | 'draft'; popularity: number; version: string; updated: string; demoUrl?: string; demoMode?: string; devices?: string[]; demoUser?: string; demoPassword?: string; freeDemo?: boolean; files?: string[]; project?: ProjectRecord }
export interface CartItem { productId: string; license: License; quantity: number }
export interface Customer { id: string; name: string; email: string; whatsapp: string; status: 'Active' | 'Inactive' }
export interface Order { id: string; customer: Customer; items: CartItem[]; total: number; date: string; paymentMethod: string; status: 'Demo completed' | 'Pending' | 'Paid'; simulated: boolean }
export interface DemoSession { name: string; email: string; role: 'customer' | 'owner' }

export * from './deployment';
