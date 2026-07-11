import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { ThemeProvider } from './context/ThemeContext';
import { ContactInfoProvider } from './context/ContactInfoContext';
import { HelmetProvider } from 'react-helmet-async';
import 'lenis/dist/lenis.css';

import SEOSchemas from './components/seo/SEOSchemas';


export default function App() {
  return (
    <HelmetProvider>
      <SEOSchemas />
      <ThemeProvider>
        <ContactInfoProvider>
          <RouterProvider router={router} />
        </ContactInfoProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}
