import { createFileRoute } from '@tanstack/react-router';
import { AdminAnalytics } from '@/components/admin/admin-pages';
import { pageHead } from '@/lib/metadata';
export const Route=createFileRoute('/admin/analytics')({head:()=>pageHead('Store analytics','Explore illustrative revenue, product views, demo interactions and conversion metrics.'),component:AdminAnalytics});
