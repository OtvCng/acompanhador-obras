/** Tela de login (e-mail + senha). Renderizada pelo ObrasProvider quando não há sessão. */
import { useState, type FormEvent } from 'react';
import { Building2, LogIn } from 'lucide-react';
import type { Usuario } from '@obras/shared';
import { Button, Card, CardContent, Input, Label } from '@/components/ui';
import { api, mensagemErro } from '@/lib/api';

export default function LoginPage({ aoEntrar }: { aoEntrar: (u: Usuario) => void }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    // Enter com o botão desabilitado ainda envia o form: valida aqui antes de chamar a API (senão vem a mensagem crua do validador).
    if (enviando) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErro('Informe um e-mail válido.'); return; }
    if (!senha) { setErro('Informe a senha.'); return; }
    setErro(null);
    setEnviando(true);
    try {
      const r = await api<{ usuario: Usuario }>('POST', '/auth/login', { email: email.trim(), senha });
      aoEntrar(r.usuario);
    } catch (err) {
      setErro(mensagemErro(err));
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-3 text-white">
          <div className="flex size-10 items-center justify-center rounded-lg bg-accent">
            <Building2 className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-semibold">Acompanhador</div>
            <div className="text-sm text-slate-400">de Obras</div>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <form className="space-y-4" onSubmit={entrar} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" autoComplete="username" inputMode="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} className="h-11" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" type="password" autoComplete="current-password" required value={senha}
                  onChange={(e) => setSenha(e.target.value)} className="h-11" />
              </div>
              {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erro}</p>}
              <Button type="submit" className="h-11 w-full" disabled={enviando || !email || !senha}>
                <LogIn /> {enviando ? 'Entrando...' : 'Entrar'}
              </Button>
              <p className="text-center text-xs text-muted">Esqueceu a senha? Peça ao diretor para redefinir.</p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
