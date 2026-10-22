import { createFileRoute } from '@tanstack/react-router';
import { DemoViewer } from '@/components/demo/demo-viewer';
import { pageHead } from '@/lib/metadata';

// Friendly catalog URL: /dashboardkeren renders the existing preview viewer.
// Uploaded code still lives on a separately hosted HTTPS origin, never this app origin.
export const Route = createFileRoute('/$productSlug')({
  head: ({ params }) => pageHead(`Live Demo: ${params.productSlug}`, 'Uji coba langsung live preview aplikasi interaktif LABDITS.'),
  component: FriendlyDemo,
});

function FriendlyDemo() {
  const { productSlug } = Route.useParams();
  return <DemoViewer slug={productSlug} />;
}
