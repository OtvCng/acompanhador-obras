import { useState } from 'react';
import { CalendarDays, CloudUpload, KeyRound, LogOut, Menu, RotateCcw, UserRound } from 'lucide-react';
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
  Label,
  Badge,
} from '@/components/ui';
import { api, hojeLocal, mensagemErro } from '@/lib/api';
import { nomePerfil } from './Sidebar';

export function Topbar({ titulo, onAbrirMenu }: { titulo: string; onAbrirMenu: () => void }) {
  const { usuarioAtual, hoje, setHoje, restaurarExemplos, sincronizando, sair } = useObras();
  const [confirmar, setConfirmar] = useState(false);
  const [conta, setConta] = useState(false);
  const [senhas, setSenhas] = useState({ atual: '', nova: '' });
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const diretor = usuarioAtual.perfil === 'diretor';
  const dataReal = hojeLocal();

  function restaurar() {
    restaurarExemplos();
    setConfirmar(false);
  }

  async function trocarSenha() {
    setErroSenha(null);
    try {
      await api('POST', '/auth/senha', senhas);
      toast.success('Senha alterada.');
      setSenhas({ atual: '', nova: '' });
      setConta(false);
    } catch (e) {
      setErroSenha(mensagemErro(e));
    }
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
        {sincronizando && (
          <span className="flex items-center gap-1 text-xs text-muted" role="status">
            <CloudUpload className="size-4 animate-pulse" /> <span className="hidden sm:inline">Salvando...</span>
          </span>
        )}

        <label className="hidden items-center gap-2 text-xs text-muted md:flex" title="Data de referência usada nos cálculos da tela. Os apontamentos sempre usam a data real.">
          <CalendarDays className="size-4" />
          Hoje
          <Input
            type="date"
            value={hoje}
            onChange={(e) => e.target.value && setHoje(e.target.value)}
            className="h-8 w-36 text-xs"
            aria-label="Data de referência (hoje)"
          />
          {hoje !== dataReal && (
            <button className="cursor-pointer text-accent underline-offset-2 hover:underline" onClick={() => setHoje(dataReal)}>voltar para hoje</button>
          )}
        </label>

        <Button
          variant="outline"
          className="h-11 max-w-44 shrink-0 gap-2 px-3 text-xs sm:h-8"
          onClick={() => { setErroSenha(null); setConta(true); }}
          aria-label="Minha conta"
        >
          <UserRound />
          <span className="flex min-w-0 flex-col text-left leading-tight">
            <span className="truncate">{usuarioAtual.nome}</span>
            <span className="text-[11px] text-muted sm:hidden">{nomePerfil(usuarioAtual.perfil)}</span>
          </span>
        </Button>
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {nomePerfil(usuarioAtual.perfil)}
        </Badge>

        {diretor && (
          <Button
            variant="outline"
            size="sm"
            className="size-11 shrink-0 px-0 sm:h-8 sm:w-auto sm:px-3"
            onClick={() => setConfirmar(true)}
            title="Recriar obras de exemplo"
            aria-label="Recriar obras de exemplo"
          >
            <RotateCcw />
            <span className="hidden xl:inline">Obras de exemplo</span>
          </Button>
        )}
      </div>

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recriar obras de exemplo?</DialogTitle>
            <DialogDescription>
              As 6 obras de demonstração voltam ao estado original (apontamentos e alterações feitos nelas se perdem). Obras reais não são afetadas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={restaurar}>
              Recriar exemplos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={conta} onOpenChange={setConta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Minha conta</DialogTitle>
            <DialogDescription>
              {usuarioAtual.nome} · {nomePerfil(usuarioAtual.perfil)}{usuarioAtual.email ? ` · ${usuarioAtual.email}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900"><KeyRound className="size-4" /> Alterar senha</p>
            <div className="space-y-1.5">
              <Label htmlFor="senha-atual">Senha atual</Label>
              <Input id="senha-atual" type="password" autoComplete="current-password" value={senhas.atual} onChange={(e) => setSenhas({ ...senhas, atual: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha-nova">Nova senha</Label>
              <Input id="senha-nova" type="password" autoComplete="new-password" placeholder="mínimo de 8 caracteres" value={senhas.nova} onChange={(e) => setSenhas({ ...senhas, nova: e.target.value })} />
            </div>
            {erroSenha && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erroSenha}</p>}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => void sair()}>
              <LogOut /> Sair
            </Button>
            <Button onClick={trocarSenha} disabled={!senhas.atual || senhas.nova.length < 8}>
              Alterar senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
