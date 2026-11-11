/** Exclusão definitiva de obra (só diretor), com confirmação digitando o nome. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Obra } from '@obras/shared';
import { useObras } from '@/store';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '@/components/ui';
import { mensagemErro } from '@/lib/api';

export function ExcluirObra({ obra }: { obra: Obra }) {
  const { usuarioAtual, excluirObra } = useObras();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  if (usuarioAtual.perfil !== 'diretor') return null;

  async function confirmar() {
    setExcluindo(true);
    try {
      await excluirObra(obra.id);
      toast.success(`Obra "${obra.nome}" excluída.`);
      navigate('/obras');
    } catch (e) {
      toast.error('Não foi possível excluir.', { description: mensagemErro(e) });
      setExcluindo(false);
    }
  }

  return (
    <div className="flex justify-end">
      <Button variant="ghost" size="sm" className="text-muted hover:text-red-700" onClick={() => { setNome(''); setAberto(true); }}>
        <Trash2 /> Excluir obra
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir obra?</DialogTitle>
            <DialogDescription>
              Apaga a obra, o cronograma, as baselines e todos os apontamentos. Não dá para desfazer. Para confirmar, digite o nome da obra.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="confirmar-nome">{obra.nome}</Label>
            <Input id="confirmar-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={nome.trim() !== obra.nome.trim() || excluindo} onClick={confirmar}>
              {excluindo ? 'Excluindo...' : 'Excluir definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
