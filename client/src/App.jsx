import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { ThemeProvider } from './context/ThemeContext';
import { ReactLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';

export default function App() {
  return (
    <ThemeProvider>
      <ReactLenis root options={{ autoRaf: true, duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) }}>
        <RouterProvider router={router} />
      </ReactLenis>
    </ThemeProvider>
  );
}

