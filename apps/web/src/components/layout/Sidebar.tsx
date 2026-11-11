import { NavLink, useLocation } from 'react-router-dom';
import { Building2, HardHat, LayoutDashboard, Layers, Users, X } from 'lucide-react';
import type { Perfil } from '@obras/shared';
import { useObras } from '@/store';
import { cn } from '@/lib/utils';

interface ItemMenu {
  to: string;
  rotulo: string;
  icone: typeof LayoutDashboard;
  /** Perfis que NÃO veem o item. */
  esconderPara?: Perfil[];
  ativo: (path: string) => boolean;
}

const ITENS: ItemMenu[] = [
  { to: '/', rotulo: 'Painel', icone: LayoutDashboard, ativo: (p) => p === '/' },
  { to: '/obras', rotulo: 'Obras', icone: Building2, ativo: (p) => p.startsWith('/obras') },
  { to: '/campo', rotulo: 'Campo', icone: HardHat, ativo: (p) => p.startsWith('/campo') },
  { to: '/modelos', rotulo: 'Modelos', icone: Layers, esconderPara: ['encarregado'], ativo: (p) => p.startsWith('/modelos') },
  { to: '/usuarios', rotulo: 'Usuários', icone: Users, esconderPara: ['engenheiro', 'encarregado'], ativo: (p) => p.startsWith('/usuarios') },
];

const NOME_PERFIL: Record<Perfil, string> = { diretor: 'Diretor', engenheiro: 'Engenheiro', encarregado: 'Encarregado' };

export function nomePerfil(p: Perfil): string {
  return NOME_PERFIL[p];
}

export function Sidebar({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  const { usuarioAtual } = useObras();
  const { pathname } = useLocation();
  const itens = ITENS.filter((i) => !i.esconderPara?.includes(usuarioAtual.perfil));
  const iniciais = usuarioAtual.nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <>
      {/* Fundo escuro do menu em tela estreita */}
      <div
        className={cn('fixed inset-0 z-40 bg-black/40 lg:hidden', aberta ? 'block' : 'hidden')}
        onClick={onFechar}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-[#0f172a] text-slate-200 transition-transform lg:static lg:translate-x-0',
          aberta ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Menu principal"
      >
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-white">
            <Building2 className="size-4.5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">Acompanhador</div>
            <div className="text-xs text-slate-400">de Obras</div>
          </div>
          <button className="ml-auto cursor-pointer rounded p-1 text-slate-400 hover:text-white lg:hidden" onClick={onFechar} aria-label="Fechar menu">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {itens.map((i) => {
            const Icone = i.icone;
            const ativo = i.ativo(pathname);
            return (
              <NavLink
                key={i.to}
                to={i.to}
                onClick={onFechar}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  ativo ? 'bg-accent text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                )}
              >
                <Icone className="size-4" />
                {i.rotulo}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4">
          <div className="flex size-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">{iniciais}</div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium text-white">{usuarioAtual.nome}</div>
            <div className="text-xs text-slate-400">{nomePerfil(usuarioAtual.perfil)}</div>
          </div>
        </div>
      </aside>
    </>
  );
}
