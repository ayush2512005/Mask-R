import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';

const Home = lazy(() => import('@/pages/Home').then((m) => ({ default: m.Home })));
const Editor = lazy(() => import('@/pages/Editor').then((m) => ({ default: m.Editor })));
const Pricing = lazy(() => import('@/pages/Pricing').then((m) => ({ default: m.Pricing })));
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Batch = lazy(() => import('@/pages/Batch').then((m) => ({ default: m.Batch })));

const PageFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AppShell>
        <Suspense fallback={<PageFallback />}>
          <Home />
        </Suspense>
      </AppShell>
    ),
  },
  {
    path: '/editor',
    element: (
      <AppShell>
        <Suspense fallback={<PageFallback />}>
          <Editor />
        </Suspense>
      </AppShell>
    ),
  },
  {
    path: '/pricing',
    element: (
      <AppShell>
        <Suspense fallback={<PageFallback />}>
          <Pricing />
        </Suspense>
      </AppShell>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <AppShell>
        <Suspense fallback={<PageFallback />}>
          <Dashboard />
        </Suspense>
      </AppShell>
    ),
  },
  {
    path: '/batch',
    element: (
      <AppShell>
        <Suspense fallback={<PageFallback />}>
          <Batch />
        </Suspense>
      </AppShell>
    ),
  },
]);

export function Router() {
  return <RouterProvider router={router} />;
}
