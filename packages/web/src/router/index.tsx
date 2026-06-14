import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';

const Home = lazy(() => import('@/pages/Home').then((m) => ({ default: m.Home })));
const Editor = lazy(() => import('@/pages/Editor').then((m) => ({ default: m.Editor })));
const ScreenGuard = lazy(() => import('@/pages/ScreenGuard').then((m) => ({ default: m.ScreenGuard })));
const DocsRedactPage = lazy(() => import('@/pages/DocsRedactPage').then((m) => ({ default: m.DocsRedactPage })));
const ImageRedactPage = lazy(() => import('@/pages/ImageRedactPage').then((m) => ({ default: m.ImageRedactPage })));
const VideoRedactPage = lazy(() => import('@/pages/VideoRedactPage').then((m) => ({ default: m.VideoRedactPage })));

const PageFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

function page(element: React.ReactNode) {
  return (
    <AppShell>
      <Suspense fallback={<PageFallback />}>
        {element}
      </Suspense>
    </AppShell>
  );
}

const router = createBrowserRouter([
  { path: '/',             element: page(<Home />) },
  { path: '/editor',       element: page(<Editor />) },
  { path: '/docs',         element: page(<DocsRedactPage />) },
  { path: '/image',        element: page(<ImageRedactPage />) },
  { path: '/video',        element: page(<VideoRedactPage />) },
  { path: '/screen-guard', element: page(<ScreenGuard />) },
]);

export function Router() {
  return <RouterProvider router={router} />;
}
