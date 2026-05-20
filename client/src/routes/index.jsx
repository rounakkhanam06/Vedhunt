import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import LandingPageLayout from '../components/layout/LandingPageLayout';

const Home = lazy(() => import('../pages/Home'));
const About = lazy(() => import('../pages/About'));
const Services = lazy(() => import('../pages/Services'));
const Portfolio = lazy(() => import('../pages/Portfolio'));
const GetQuote = lazy(() => import('../pages/GetQuote'));
const Pricing = lazy(() => import('../pages/Pricing'));
const Career = lazy(() => import('../pages/Career'));
const Blog = lazy(() => import('../pages/Blog'));
const BlogDetail = lazy(() => import('../pages/BlogDetail'));
const ServiceDetails = lazy(() => import('../pages/ServiceDetails'));
const NotFound = lazy(() => import('../pages/NotFound'));
const LandingPage = lazy(() => import('../pages/LandingPage'));


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
        path: 'get-quote',
        element: withSuspense(GetQuote)
      },
      {
        path: 'pricing',
        element: withSuspense(Pricing)
      },
      {
        path: 'career',
        element: withSuspense(Career)
      },
      {
        path: 'blog',
        element: withSuspense(Blog)
      },
      {
        path: 'blog/:id',
        element: withSuspense(BlogDetail)
      },
      {
        path: 'service/:slug',
        element: withSuspense(ServiceDetails)
      },
      {
        path: 'services/:slug',
        element: withSuspense(ServiceDetails)
      },
      {
        path: '*',
        element: withSuspense(NotFound)
      }

    ]
  },
  {
    path: '/lp',
    element: <LandingPageLayout />,
    children: [
      {
        path: ':slug',
        element: withSuspense(LandingPage)
      }
    ]
  }
]);
