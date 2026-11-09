import { Toaster } from 'sonner';

/**
 * Toaster das telas da Telas-Campo. Provisório: quando houver um <Toaster> global (main.tsx/AppLayout),
 * remover os usos deste componente para não duplicar toasts.
 */
export default function ToasterCampo() {
  return <Toaster position="top-center" richColors closeButton toastOptions={{ className: 'text-sm' }} />;
}
