// Provisório. Dono: Telas-Gestão (substituir por Sidebar + Topbar).
import { Outlet, NavLink } from 'react-router-dom';
export default function AppLayout() {
  return (
    <div className="flex h-full">
      <aside className="w-56 bg-primary text-primary-foreground p-4 space-y-2">
        <div className="font-semibold mb-4">Acompanhador de Obras</div>
        {[['/', 'Painel'], ['/obras', 'Obras'], ['/campo', 'Campo'], ['/modelos', 'Modelos']].map(([to, l]) => (
          <NavLink key={to} to={to} end className="block opacity-80 hover:opacity-100">{l}</NavLink>
        ))}
      </aside>
      <main className="flex-1 overflow-auto p-6"><Outlet /></main>
    </div>
  );
}
