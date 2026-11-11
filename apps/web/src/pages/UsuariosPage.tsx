/** Cadastro de usuários (só diretor): criar, editar perfil, ativar/desativar e redefinir senha. */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { KeyRound, Pencil, Plus, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import type { Perfil, Usuario } from '@obras/shared';
import { useObras } from '@/store';
import {
  Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui';
import { nomePerfil } from '@/components/layout/Sidebar';
import { api, mensagemErro } from '@/lib/api';

type UsuarioAdmin = Usuario & { temSenha?: boolean };
type Form = { id?: string; nome: string; email: string; perfil: Perfil; senha: string };
const VAZIO: Form = { nome: '', email: '', perfil: 'engenheiro', senha: '' };

export default function UsuariosPage() {
  const { usuarios, usuarioAtual, recarregarUsuarios } = useObras();
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Só o diretor gerencia usuários; os demais (ex.: quem logou depois do diretor nesta URL) voltam ao painel.
  if (usuarioAtual.perfil !== 'diretor') return <Navigate to="/" replace />;

  // Usuário de exemplo COM senha (ex.: engenheira de teste) entra no sistema: fica na lista editável.
  const reais = (usuarios as UsuarioAdmin[]).filter((u) => !u.exemplo || u.temSenha);
  const ficticios = (usuarios as UsuarioAdmin[]).filter((u) => u.exemplo && !u.temSenha);
  const abrirEdicao = (u: UsuarioAdmin) => { setErro(null); setForm({ id: u.id, nome: u.nome, email: u.email ?? '', perfil: u.perfil, senha: '' }); };
  const editando = !!form?.id;

  async function salvar() {
    if (!form) return;
    setErro(null);
    setSalvando(true);
    try {
      if (form.id) {
        await api('PATCH', `/usuarios/${form.id}`, { nome: form.nome, email: form.email, perfil: form.perfil, ...(form.senha ? { senha: form.senha } : {}) });
        toast.success('Usuário atualizado.');
      } else {
        await api('POST', '/usuarios', form);
        toast.success('Usuário criado. Passe o e-mail e a senha para a pessoa.');
      }
      await recarregarUsuarios();
      setForm(null);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(u: UsuarioAdmin) {
    try {
      await api('PATCH', `/usuarios/${u.id}`, { ativo: !u.ativo });
      await recarregarUsuarios();
      toast.success(u.ativo ? `${u.nome} desativado.` : `${u.nome} reativado.`);
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  }

  const valido = !!form && form.nome.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) && (editando ? !form.senha || form.senha.length >= 8 : form.senha.length >= 8);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Usuários</CardTitle>
            <CardDescription>Quem entra no sistema. Engenheiro vê e edita as obras em que é responsável; encarregado só lança avanço nas suas obras e não vê valores.</CardDescription>
          </div>
          <Button onClick={() => { setErro(null); setForm({ ...VAZIO }); }} className="h-11 shrink-0 self-start sm:h-9 sm:self-auto"><Plus /> Novo usuário</Button>
        </CardHeader>
        {/* Celular: cartões (a tabela empurrava as ações para fora da tela). */}
        <CardContent className="space-y-2 sm:hidden">
          {reais.map((u) => (
            <div key={u.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">{u.nome}{u.id === usuarioAtual.id && <span className="ml-1 text-xs text-muted">(você)</span>}</div>
                  <div className="truncate text-xs text-muted">{u.email}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="secondary">{nomePerfil(u.perfil)}</Badge>
                  {!u.ativo && <Badge variant="outline">Desativado</Badge>}
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <Button variant="outline" className="h-11 flex-1" onClick={() => abrirEdicao(u)}><Pencil /> Editar</Button>
                {u.id !== usuarioAtual.id && (
                  <Button variant="outline" className="h-11 flex-1" onClick={() => alternarAtivo(u)}>
                    {u.ativo ? <><UserX /> Desativar</> : <><UserCheck /> Reativar</>}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
        <CardContent className="hidden overflow-x-auto sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reais.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome}{u.id === usuarioAtual.id && <span className="ml-1 text-xs text-muted">(você)</span>}</TableCell>
                  <TableCell className="text-muted">{u.email}</TableCell>
                  <TableCell><Badge variant="secondary">{nomePerfil(u.perfil)}</Badge></TableCell>
                  <TableCell>{u.ativo ? <Badge variant="secondary">Ativo</Badge> : <Badge variant="outline">Desativado</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => abrirEdicao(u)}>
                        <Pencil /> Editar
                      </Button>
                      {u.id !== usuarioAtual.id && (
                        <Button variant="ghost" size="sm" onClick={() => alternarAtivo(u)}>
                          {u.ativo ? <><UserX /> Desativar</> : <><UserCheck /> Reativar</>}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {ficticios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usuários fictícios das obras de exemplo</CardTitle>
            <CardDescription>Existem só para as obras de demonstração. Não têm senha e não entram no sistema.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {ficticios.map((u) => <Badge key={u.id} variant="outline">{u.nome} ({nomePerfil(u.perfil)})</Badge>)}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!form} onOpenChange={(a) => !a && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
            <DialogDescription>{editando ? 'Deixe a senha em branco para manter a atual. Trocar a senha encerra as sessões abertas da pessoa.' : 'A pessoa entra com este e-mail e esta senha.'}</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="u-nome">Nome</Label><Input id="u-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="u-email">E-mail</Label><Input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Perfil</Label>
                <Select value={form.perfil} onValueChange={(p) => setForm({ ...form, perfil: p as Perfil })} disabled={form.id === usuarioAtual.id}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diretor">Diretor</SelectItem>
                    <SelectItem value="engenheiro">Engenheiro</SelectItem>
                    <SelectItem value="encarregado">Encarregado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-senha" className="flex items-center gap-1"><KeyRound className="size-3.5" /> {editando ? 'Nova senha (opcional)' : 'Senha inicial'}</Label>
                <Input id="u-senha" type="text" autoComplete="new-password" placeholder="mínimo de 8 caracteres" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
              </div>
              {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erro}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={!valido || salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
