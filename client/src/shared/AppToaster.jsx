import { Toaster } from 'react-hot-toast';

/** The admin-panel toast style, shared by panels that mount their own Toaster. */
export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        className: 'dark:!bg-[#1A1A1A] dark:!text-white dark:!border-[#2D2D33] !bg-white !text-gray-900 !border-gray-200',
        style: { border: '1px solid rgba(150, 150, 150, 0.2)', borderRadius: '8px' },
        success: { iconTheme: { primary: '#FF6B00', secondary: 'transparent' } },
      }}
    />
  );
}
