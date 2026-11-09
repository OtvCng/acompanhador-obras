import { ajustarValorEtapa, pavimentosPadrao as pavimentosPadraoShared, type ModeloObra, type Obra, type ParametrosNovaObra, type TipoObra, type TipoPavimento } from '@obras/shared';
import { lerNumero } from '@/components/campo/formatos';

export type Desdobramento = ModeloObra['desdobramento'];

export interface PavimentoForm {
  chave: string;
  nome: string;
  tipoPavimento: TipoPavimento;
}

export interface FormNovaObra {
  tipo: TipoObra | null;
  nome: string;
  endereco: string;
  cidade: string;
  area: string;
  dataInicio: string;
  orcamento: string;
  engenheiroId: string;
  encarregadoId: string;
  pavimentos: PavimentoForm[];
  unidades: string;
}

let seq = 0;
export const novaChave = () => `pav-${Date.now().toString(36)}-${++seq}`;

/** Desdobramento do modelo; se o modelo ainda não estiver carregado, cai num padrão razoável por tipo. */
export function desdobramentoDe(tipo: TipoObra | null, modelo: ModeloObra | undefined): Desdobramento {
  if (modelo) return modelo.desdobramento;
  if (tipo === 'geminadas') return 'unidades';
  if (tipo === 'sobrado' || tipo === 'predio_3_6' || tipo === 'predio_7_mais') return 'pavimentos';
  return 'nenhum';
}

export function nomeTipo(n: number) {
  return `${n}º pavimento`;
}

/** Pavimentos sugeridos ao escolher o tipo (padrão do pacote shared; o usuário edita depois). */
export function pavimentosPadrao(tipo: TipoObra | null): PavimentoForm[] {
  if (!tipo) return [];
  return pavimentosPadraoShared(tipo).map((p) => ({ chave: novaChave(), ...p }));
}

const ABAIXO_DO_TIPO: TipoPavimento[] = ['subsolo_garagem', 'terreo', 'terreo_comercial'];

/** Troca todos os pavimentos tipo por N novos, entre os de baixo (subsolo/térreo) e os de cima (cobertura/casa de máquinas). */
export function gerarPavimentosTipo(atuais: PavimentoForm[], n: number): PavimentoForm[] {
  const baixo = atuais.filter((x) => ABAIXO_DO_TIPO.includes(x.tipoPavimento));
  const cima = atuais.filter((x) => x.tipoPavimento === 'cobertura' || x.tipoPavimento === 'casa_maquinas');
  const novos = Array.from({ length: n }, (_, i) => ({ chave: novaChave(), nome: nomeTipo(i + 1), tipoPavimento: 'tipo' as const }));
  return [...baixo, ...novos, ...cima];
}

export function formInicial(hoje: string, engenheiroId = ''): FormNovaObra {
  return {
    tipo: null,
    nome: '',
    endereco: '',
    cidade: '',
    area: '',
    dataInicio: hoje,
    orcamento: '',
    engenheiroId,
    encarregadoId: '',
    pavimentos: [],
    unidades: '2',
  };
}

export type ErrosParametros = Partial<Record<keyof FormNovaObra, string>>;

export function validarParametros(f: FormNovaObra, desd: Desdobramento): ErrosParametros {
  const e: ErrosParametros = {};
  if (!f.nome.trim()) e.nome = 'Informe o nome da obra.';
  if (!f.endereco.trim()) e.endereco = 'Informe o endereço.';
  if (!f.cidade.trim()) e.cidade = 'Informe a cidade.';
  const area = lerNumero(f.area);
  if (!(area > 0)) e.area = 'Informe uma área maior que zero.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.dataInicio)) e.dataInicio = 'Informe a data de início.';
  const orc = lerNumero(f.orcamento);
  if (!(orc > 0)) e.orcamento = 'Informe um orçamento maior que zero.';
  if (!f.engenheiroId) e.engenheiroId = 'Escolha o engenheiro responsável.';
  if (!f.encarregadoId) e.encarregadoId = 'Escolha o encarregado.';
  if (desd === 'pavimentos') {
    if (f.pavimentos.length === 0) e.pavimentos = 'Adicione pelo menos um pavimento.';
    else if (f.pavimentos.some((p) => !p.nome.trim())) e.pavimentos = 'Todo pavimento precisa de um nome.';
  }
  if (desd === 'unidades') {
    const u = Number(f.unidades);
    if (!Number.isInteger(u) || u < 2) e.unidades = 'Informe ao menos 2 unidades.';
    else if (u > 50) e.unidades = 'Máximo de 50 unidades.';
  }
  return e;
}

export function paramsDe(f: FormNovaObra, desd: Desdobramento): ParametrosNovaObra | null {
  if (!f.tipo) return null;
  const p: ParametrosNovaObra = {
    nome: f.nome.trim(),
    tipo: f.tipo,
    endereco: f.endereco.trim(),
    cidade: f.cidade.trim(),
    areaM2: lerNumero(f.area),
    dataInicio: f.dataInicio,
    orcamentoTotal: Math.round(lerNumero(f.orcamento) * 100) / 100,
    engenheiroId: f.engenheiroId,
    encarregadoId: f.encarregadoId,
  };
  if (desd === 'pavimentos') p.pavimentos = f.pavimentos.map(({ nome, tipoPavimento }) => ({ nome: nome.trim(), tipoPavimento }));
  if (desd === 'unidades') p.unidades = Number(f.unidades);
  return p;
}

/**
 * Aplica valores editados por etapa (R$) à obra gerada. Usa ajustarValorEtapa do shared sem compensar
 * as outras etapas (manterTotal = false): o valor é redistribuído proporcionalmente entre as atividades
 * da etapa e ela deixa de ser "estimativa". O orçamento total continua o informado no passo 2; quem
 * confere a soma é a tela.
 */
export function aplicarValoresEtapas(obra: Obra, valores: Record<number, number>): Obra {
  let atual = obra;
  for (const [codigo, valor] of Object.entries(valores)) {
    const etapa = atual.etapas.find((e) => e.codigo === Number(codigo));
    if (!etapa || Math.abs(etapa.valorOrcado - valor) < 0.005) continue;
    atual = ajustarValorEtapa(atual, Number(codigo), valor, false);
  }
  return atual === obra ? obra : { ...atual, orcamentoTotal: obra.orcamentoTotal };
}
