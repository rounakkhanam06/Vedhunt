import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import App from './App.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 2 * 60 * 1000,  // Data stays fresh for 2 minutes — eliminates redundant API refetches
      gcTime: 10 * 60 * 1000,    // Keep unused cache alive for 10 minutes for instant back-navigation
    },
  },
})

// Clicking anywhere on a date/time input opens its calendar, not just the
// small icon — browsers otherwise only select the dd/mm/yyyy segment.
const PICKER_TYPES = new Set(['date', 'datetime-local', 'month', 'week', 'time'])
document.addEventListener('click', (e) => {
  const input = e.target
  if (!(input instanceof HTMLInputElement) || !PICKER_TYPES.has(input.type)) return
  if (input.disabled || input.readOnly || typeof input.showPicker !== 'function') return
  try { input.showPicker() } catch { /* already open, or not allowed in this frame */ }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
)
