import { useState } from 'react';
import { Outlet, useLocation, matchPath } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { TooltipProvider } from '@/components/ui';
import { useObras } from '@/store';

function useTituloPagina(): string {
  const { pathname } = useLocation();
  const { obras } = useObras();
  if (pathname === '/') return 'Painel';
  if (matchPath('/obras/nova', pathname)) return 'Nova obra';
  const det = matchPath('/obras/:id', pathname);
  if (det) return obras.find((o) => o.id === det.params.id)?.nome ?? 'Detalhe da obra';
  if (pathname.startsWith('/obras')) return 'Obras';
  if (pathname.startsWith('/campo')) return 'Campo';
  if (pathname.startsWith('/modelos')) return 'Modelos de obra';
  return 'Acompanhador de Obras';
}

export default function AppLayout() {
  const [menuAberto, setMenuAberto] = useState(false);
  const titulo = useTituloPagina();
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full">
        <Sidebar aberta={menuAberto} onFechar={() => setMenuAberto(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar titulo={titulo} onAbrirMenu={() => setMenuAberto(true)} />
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <Toaster position="bottom-right" richColors />
    </TooltipProvider>
  );
}
