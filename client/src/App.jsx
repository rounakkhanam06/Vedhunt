import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { ThemeProvider } from './context/ThemeContext';
import { ContactInfoProvider } from './context/ContactInfoContext';
import { ReactLenis } from 'lenis/react';
import { HelmetProvider } from 'react-helmet-async';
import 'lenis/dist/lenis.css';

import { useEffect } from 'react';

import api from './services/api';

export default function App() {
  useEffect(() => {
    // Defer Facebook Pixel initialization to prioritize initial render
    const timer = setTimeout(() => {
      api.get('/settings/facebook')
        .then(res => {
          const data = res.data;
          if (data && data.pixelId) {
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            
            window.fbq('init', data.pixelId);
            window.fbq('track', 'PageView');
          }
        })
        .catch(err => console.error('Error loading FB pixel:', err));
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <HelmetProvider>
      <ThemeProvider>
        <ContactInfoProvider>
          <ReactLenis root options={{ autoRaf: true, duration: 0.9, lerp: 0.1 }}>
            <RouterProvider router={router} />
          </ReactLenis>
        </ContactInfoProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}
