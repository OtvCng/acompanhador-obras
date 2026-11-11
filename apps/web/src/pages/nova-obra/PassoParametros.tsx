import { useMemo } from 'react';
import { ehDiaUtil, feriadosNacionais, type Usuario } from '@obras/shared';
import { Aviso, Campo, Entrada, Selecao } from '@/components/campo/ui';
import { diaDaSemana, formatarBRL, formatarData, lerNumero } from '@/components/campo/formatos';
import EditorPavimentos from './EditorPavimentos';
import type { Desdobramento, ErrosParametros, FormNovaObra } from './estado';

/** Motivo de a data não ser dia útil (fim de semana, feriado nacional) ou null. */
function avisoData(d: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const dow = diaDaSemana(d);
  if (dow === 0) return 'A data cai num domingo.';
  if (dow === 6) return 'A data cai num sábado.';
  let feriados: string[] = [];
  try {
    feriados = feriadosNacionais(Number(d.slice(0, 4)));
  } catch {
    /* motor ainda não pronto */
  }
  if (feriados.includes(d)) return 'A data é feriado nacional.';
  try {
    if (!ehDiaUtil(d)) return 'A data não é dia útil.';
  } catch {
    /* idem */
  }
  return null;
}

export default function PassoParametros({
  form,
  set,
  desdobramento,
  usuarios,
  erros,
  mostrarErros,
}: {
  form: FormNovaObra;
  set: (p: Partial<FormNovaObra>) => void;
  desdobramento: Desdobramento;
  usuarios: Usuario[];
  erros: ErrosParametros;
  mostrarErros: boolean;
}) {
  // Usuários ativos; os fictícios das obras de exemplo (que também servem de login de teste) vão num grupo à parte.
  const ativos = usuarios.filter((u) => u.ativo !== false);
  const ehEng = (u: Usuario) => u.perfil === 'engenheiro' || u.perfil === 'diretor';
  const engenheiros = ativos.filter((u) => ehEng(u) && !u.exemplo);
  const engenheirosExemplo = ativos.filter((u) => ehEng(u) && u.exemplo);
  const soEncarregados = ativos.filter((u) => u.perfil === 'encarregado' && !u.exemplo);
  // Sem encarregado real cadastrado ainda: deixa escolher qualquer usuário real (ex.: o próprio engenheiro toca a obra).
  const encarregados = soEncarregados.length ? soEncarregados : ativos.filter((u) => !u.exemplo);
  const encarregadosExemplo = ativos.filter((u) => u.perfil === 'encarregado' && u.exemplo);
  const aviso = useMemo(() => avisoData(form.dataInicio), [form.dataInicio]);
  const err = (k: keyof FormNovaObra) => (mostrarErros ? erros[k] : undefined);
  const orc = lerNumero(form.orcamento);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Parâmetros da obra</h2>
        <p className="text-sm text-muted">Esses dados geram os locais, o cronograma e a distribuição do orçamento.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome da obra" erro={err('nome')} className="sm:col-span-2">
          <Entrada value={form.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Residencial Jardim das Flores" invalido={!!err('nome')} />
        </Campo>
        <Campo rotulo="Endereço" erro={err('endereco')}>
          <Entrada value={form.endereco} onChange={(e) => set({ endereco: e.target.value })} placeholder="Rua, número, bairro" invalido={!!err('endereco')} />
        </Campo>
        <Campo rotulo="Cidade" erro={err('cidade')}>
          <Entrada value={form.cidade} onChange={(e) => set({ cidade: e.target.value })} placeholder="Cidade / UF" invalido={!!err('cidade')} />
        </Campo>
        <Campo rotulo="Área construída (m²)" erro={err('area')}>
          <Entrada inputMode="decimal" value={form.area} onChange={(e) => set({ area: e.target.value })} placeholder="Ex.: 180" invalido={!!err('area')} />
        </Campo>
        <Campo rotulo="Orçamento total (R$)" erro={err('orcamento')} ajuda={orc > 0 ? formatarBRL(orc) : 'Use vírgula para centavos.'}>
          <Entrada inputMode="decimal" value={form.orcamento} onChange={(e) => set({ orcamento: e.target.value })} placeholder="Ex.: 850.000,00" invalido={!!err('orcamento')} />
        </Campo>
        <div className="space-y-2 sm:col-span-2">
          <Campo rotulo="Data de início" erro={err('dataInicio')} className="sm:w-1/2 sm:pr-2">
            <Entrada type="date" value={form.dataInicio} onChange={(e) => set({ dataInicio: e.target.value })} invalido={!!err('dataInicio')} />
          </Campo>
          {aviso && (
            <Aviso titulo={`${aviso} (${formatarData(form.dataInicio)})`}>
              O cronograma considera só dias úteis (segunda a sexta, sem feriados nacionais), então a primeira atividade começa no próximo dia útil.
            </Aviso>
          )}
        </div>
        <Campo rotulo="Engenheiro responsável" erro={err('engenheiroId')} ajuda={engenheiros.length + engenheirosExemplo.length === 0 ? 'Nenhum usuário com perfil de engenheiro cadastrado ainda.' : undefined}>
          <Selecao value={form.engenheiroId} onChange={(e) => set({ engenheiroId: e.target.value })} invalido={!!err('engenheiroId')}>
            <option value="">Selecione</option>
            {engenheiros.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
                {u.perfil === 'diretor' ? ' (diretor)' : ''}
              </option>
            ))}
            {engenheirosExemplo.length > 0 && (
              <optgroup label="Usuários de exemplo">
                {engenheirosExemplo.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                    {u.perfil === 'diretor' ? ' (diretor)' : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </Selecao>
        </Campo>
        <Campo rotulo="Encarregado" erro={err('encarregadoId')} ajuda={encarregados.length + encarregadosExemplo.length === 0 ? 'Nenhum usuário com perfil de encarregado cadastrado ainda.' : undefined}>
          <Selecao value={form.encarregadoId} onChange={(e) => set({ encarregadoId: e.target.value })} invalido={!!err('encarregadoId')}>
            <option value="">Selecione</option>
            {encarregados.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
            {encarregadosExemplo.length > 0 && (
              <optgroup label="Usuários de exemplo">
                {encarregadosExemplo.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </optgroup>
            )}
          </Selecao>
        </Campo>
      </div>

      {desdobramento === 'pavimentos' && (
        <div className="border-t border-border pt-5">
          <EditorPavimentos valor={form.pavimentos} aoMudar={(pavimentos) => set({ pavimentos })} erro={err('pavimentos')} />
        </div>
      )}
      {desdobramento === 'unidades' && (
        <div className="border-t border-border pt-5">
          <Campo rotulo="Número de unidades (casas)" erro={err('unidades')} ajuda="Cada unidade vira um local de apontamento." className="sm:w-1/2 sm:pr-2">
            <Entrada type="number" min={2} max={50} inputMode="numeric" value={form.unidades} onChange={(e) => set({ unidades: e.target.value })} invalido={!!err('unidades')} />
          </Campo>
        </div>
      )}
    </div>
  );
}
