import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';

const Home = lazy(() => import('../pages/Home'));
const About = lazy(() => import('../pages/About'));
const Services = lazy(() => import('../pages/Services'));
const Portfolio = lazy(() => import('../pages/Portfolio'));
const Contact = lazy(() => import('../pages/Contact'));
const NotFound = lazy(() => import('../pages/NotFound'));

// High-fidelity, smooth loading fallback component to display during chunk fetching
const withSuspense = (Component) => (
  <Suspense 
    fallback={
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    }
  >
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        path: '',
        element: withSuspense(Home)
      },
      {
        path: 'about',
        element: withSuspense(About)
      },
      {
        path: 'services',
        element: withSuspense(Services)
      },
      {
        path: 'portfolio',
        element: withSuspense(Portfolio)
      },
      {
        path: 'contact',
        element: withSuspense(Contact)
      },
      {
        path: '*',
        element: withSuspense(NotFound)
      }
    ]
  }
]);
