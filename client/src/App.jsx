import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { ThemeProvider } from './context/ThemeContext';
import { ReactLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';

export default function App() {
  return (
    <ThemeProvider>
      <ReactLenis root options={{ autoRaf: true, duration: 0.9, lerp: 0.1 }}>
        <RouterProvider router={router} />
      </ReactLenis>
    </ThemeProvider>
  );
}
