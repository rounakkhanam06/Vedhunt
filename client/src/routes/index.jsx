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
const CareerSuccess = lazy(() => import('../pages/CareerSuccess'));
const Blog = lazy(() => import('../pages/Blog'));
const BlogDetail = lazy(() => import('../pages/BlogDetail'));
const ServiceDetails = lazy(() => import('../pages/ServiceDetails'));
const NotFound = lazy(() => import('../pages/NotFound'));
const LandingPage = lazy(() => import('../pages/LandingPage'));
const PrivacyPolicy = lazy(() => import('../pages/PrivacyPolicy'));
const TermsConditions = lazy(() => import('../pages/TermsConditions'));
const RefundPolicy = lazy(() => import('../pages/RefundPolicy'));
const CookiePolicy = lazy(() => import('../pages/CookiePolicy'));
const DPA = lazy(() => import('../pages/DPA'));
const FAQ = lazy(() => import('../pages/FAQ'));
const ThankYou = lazy(() => import('../pages/ThankYou'));

// Admin Pages
const AdminLayout = lazy(() => import('../admin/AdminLayout'));
const PrivateRoute = lazy(() => import('../admin/PrivateRoute'));
const Login = lazy(() => import('../admin/pages/Login'));
const Dashboard = lazy(() => import('../admin/pages/Dashboard'));
const HeroManager = lazy(() => import('../admin/pages/HeroManager'));
const SettingsPage = lazy(() => import('../admin/pages/SettingsPage'));
const ProfilePage = lazy(() => import('../admin/pages/ProfilePage'));
const TeamManagement = lazy(() => import('../admin/pages/TeamManagement'));
const ForgotPassword = lazy(() => import('../admin/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('../admin/pages/ResetPassword'));
const NavbarManager = lazy(() => import('../admin/pages/NavbarManager'));
const ServiceManager = lazy(() => import('../admin/pages/ServiceManager'));
const ServicePagesManager = lazy(() => import('../admin/pages/ServicePagesManager'));
const PortfolioManager = lazy(() => import('../admin/pages/PortfolioManager'));
const LandingPageManager = lazy(() => import('../admin/pages/LandingPageManager'));
const TestimonialManager = lazy(() => import('../admin/pages/TestimonialManager'));
const PricingManager = lazy(() => import('../admin/pages/PricingManager'));
const HomePricingManager = lazy(() => import('../admin/pages/HomePricingManager'));
const PresenceManager = lazy(() => import('../admin/pages/PresenceManager'));
const CareerHeroManager = lazy(() => import('../admin/pages/CareerHeroManager'));
const LifeAtVedhuntManager = lazy(() => import('../admin/pages/LifeAtVedhuntManager'));
const AboutManager = lazy(() => import('../admin/pages/AboutManager'));
const BlogManager = lazy(() => import('../admin/pages/BlogManager'));
const CreateEditBlog = lazy(() => import('../admin/pages/CreateEditBlog'));
const JobManager = lazy(() => import('../admin/pages/JobManager'));
const ApplicationManager = lazy(() => import('../admin/pages/ApplicationManager'));
const FAQManager = lazy(() => import('../admin/pages/FAQManager'));
const PrivacyPolicyManager = lazy(() => import('../admin/pages/PrivacyPolicyManager'));
const TermsConditionsManager = lazy(() => import('../admin/pages/TermsConditionsManager'));
const CookiePolicyManager = lazy(() => import('../admin/pages/CookiePolicyManager'));
const DPAManager = lazy(() => import('../admin/pages/DPAManager'));
const RefundPolicyManager = lazy(() => import('../admin/pages/RefundPolicyManager'));
const LeadsManager = lazy(() => import('../admin/pages/LeadsManager'));

import AdminThemeGuard from '../admin/components/AdminThemeGuard';
import { Outlet } from 'react-router-dom';

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

// Wraps all admin routes to force dark mode and isolate them from user panel theme toggles
const AdminRoot = () => (
  <AdminThemeGuard>
    <Outlet />
  </AdminThemeGuard>
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
        path: 'career/success',
        element: withSuspense(CareerSuccess)
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
        path: 'privacy-policy',
        element: withSuspense(PrivacyPolicy)
      },
      {
        path: 'terms-and-conditions',
        element: withSuspense(TermsConditions)
      },
      {
        path: 'refund-and-billing-policy',
        element: withSuspense(RefundPolicy)
      },
      {
        path: 'cookie-policy',
        element: withSuspense(CookiePolicy)
      },
      {
        path: 'data-processing-agreement',
        element: withSuspense(DPA)
      },
      {
        path: 'faq',
        element: withSuspense(FAQ)
      },
      {
        path: 'thank-you',
        element: withSuspense(ThankYou)
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
  },
  {
    path: '/admin',
    element: <AdminRoot />,
    children: [
      {
        path: 'login',
        element: withSuspense(Login)
      },
      {
        path: 'forgot-password',
        element: withSuspense(ForgotPassword)
      },
      {
        path: 'reset-password/:token',
        element: withSuspense(ResetPassword)
      },
      {
        path: '',
        element: withSuspense(PrivateRoute),
        children: [
      {
        path: '',
        element: withSuspense(AdminLayout),
        children: [
          {
            path: 'dashboard',
            element: withSuspense(Dashboard)
          },
          {
            path: 'landing-page',
            element: withSuspense(LandingPageManager)
          },
          {
            path: 'navbar',
            element: withSuspense(NavbarManager)
          },
          {
            path: 'services',
            element: withSuspense(ServiceManager)
          },
          {
            path: 'service-pages',
            element: withSuspense(ServicePagesManager)
          },
          {
            path: 'settings',
            element: withSuspense(SettingsPage)
          },
          {
            path: 'profile',
            element: withSuspense(ProfilePage)
          },
          {
            path: 'team',
            element: withSuspense(TeamManagement)
          },
          {
            path: 'portfolio',
            element: withSuspense(PortfolioManager)
          },
          {
            path: 'testimonials',
            element: withSuspense(TestimonialManager)
          },
          {
            path: 'pricing',
            element: withSuspense(PricingManager)
          },
          {
            path: 'home-pricing',
            element: withSuspense(HomePricingManager)
          },
          {
            path: 'presence',
            element: withSuspense(PresenceManager)
          },
          {
            path: 'about',
            element: withSuspense(AboutManager)
          },
          {
            path: 'blogs',
            element: withSuspense(BlogManager)
          },
          {
            path: 'blogs/create',
            element: withSuspense(CreateEditBlog)
          },
          {
            path: 'blogs/edit/:slug',
            element: withSuspense(CreateEditBlog)
          },
          {
            path: 'jobs',
            element: withSuspense(JobManager)
          },
          {
            path: 'career-hero',
            element: withSuspense(CareerHeroManager)
          },
          {
            path: 'life-at-vedhunt',
            element: withSuspense(LifeAtVedhuntManager)
          },
          {
            path: 'applications',
            element: withSuspense(ApplicationManager)
          },
          {
            path: 'faq',
            element: withSuspense(FAQManager)
          },
          {
            path: 'privacy-policy',
            element: withSuspense(PrivacyPolicyManager)
          },
          {
            path: 'terms-and-conditions',
            element: withSuspense(TermsConditionsManager)
          },
          {
            path: 'cookie-policy',
            element: withSuspense(CookiePolicyManager)
          },
          {
            path: 'data-processing-agreement',
            element: withSuspense(DPAManager)
          },
          {
            path: 'refund-policy',
            element: withSuspense(RefundPolicyManager)
          },
          {
            path: 'leads',
            element: withSuspense(LeadsManager)
          },
          {
            path: '',
            element: withSuspense(Dashboard) // Default redirect
          }
        ]
      }
    ]
  }
    ]
  }
]);
