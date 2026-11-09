import { useState } from 'react';
import { CalendarDays, Menu, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useObras } from '@/store';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from '@/components/ui';
import { nomePerfil } from './Sidebar';

export function Topbar({ titulo, onAbrirMenu }: { titulo: string; onAbrirMenu: () => void }) {
  const { usuarios, usuarioAtual, setUsuarioAtual, hoje, setHoje, restaurarExemplos } = useObras();
  const [confirmar, setConfirmar] = useState(false);

  function restaurar() {
    try {
      restaurarExemplos();
      toast.success('Dados de exemplo restaurados.');
    } catch (e) {
      toast.error(`Não foi possível restaurar: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
    }
    setConfirmar(false);
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur sm:gap-3 sm:px-4 lg:px-6">
      <button
        className="-ml-1.5 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 lg:hidden"
        onClick={onAbrirMenu}
        aria-label="Abrir menu"
      >
        <Menu className="size-5" />
      </button>
      <h1 className="min-w-0 truncate text-base font-semibold text-gray-900 lg:text-lg">{titulo}</h1>

      <div className="ml-auto flex items-center gap-2 lg:gap-3">
        <label className="hidden items-center gap-2 text-xs text-muted md:flex" title="Data de referência usada em todos os cálculos">
          <CalendarDays className="size-4" />
          Hoje
          <Input
            type="date"
            value={hoje}
            onChange={(e) => e.target.value && setHoje(e.target.value)}
            className="h-8 w-36 text-xs"
            aria-label="Data de referência (hoje)"
          />
        </label>

        <div className="flex min-w-0 items-center gap-2">
          <Select value={usuarioAtual.id} onValueChange={setUsuarioAtual}>
            {/* Celular: alvo de 44 px e nome + perfil em duas linhas, sem corte no meio do perfil. */}
            <SelectTrigger className="h-11 w-36 text-xs sm:h-8 sm:w-48" aria-label="Usuário simulado">
              <SelectValue placeholder="Usuário">
                <span className="flex min-w-0 flex-col text-left leading-tight">
                  <span className="truncate">{usuarioAtual.nome}</span>
                  <span className="text-[11px] text-muted sm:hidden">{nomePerfil(usuarioAtual.perfil)}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome} ({nomePerfil(u.perfil)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {nomePerfil(usuarioAtual.perfil)}
          </Badge>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="size-11 shrink-0 px-0 sm:h-8 sm:w-auto sm:px-3"
          onClick={() => setConfirmar(true)}
          title="Restaurar dados de exemplo"
          aria-label="Restaurar dados de exemplo"
        >
          <RotateCcw />
          <span className="hidden xl:inline">Restaurar dados de exemplo</span>
        </Button>
      </div>

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar dados de exemplo?</DialogTitle>
            <DialogDescription>
              Todas as obras, apontamentos e alterações feitas neste navegador serão substituídos pelas 6 obras de exemplo. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={restaurar}>
              Restaurar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
