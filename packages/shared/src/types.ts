/**
 * CONTRATO DE TIPOS do Acompanhador de Obras.
 * Escrito pelo orquestrador. Terminais NÃO mudam assinaturas sem combinar na nota de status.
 *
 * Convenções:
 * - Datas são strings ISO "YYYY-MM-DD" (sem hora, sem fuso).
 * - Percentuais de avanço: 0 a 100. Frações internas do motor: 0 a 1.
 * - Valores em R$: number (reais, 2 casas).
 */

export type ISODate = string;

// ---------------------------------------------------------------------------
// Usuários e perfis (Q5)
// ---------------------------------------------------------------------------
export type Perfil = 'diretor' | 'engenheiro' | 'encarregado';

export interface Usuario {
  id: string;
  nome: string;
  perfil: Perfil;
  /** (Banco/API) Só vem para o diretor. */
  email?: string | null;
  /** (Banco/API) false = desativado, não entra e não aparece para novas obras. */
  ativo?: boolean;
  /** (Banco/API) true = usuário fictício das obras de exemplo, sem login. */
  exemplo?: boolean;
}

// ---------------------------------------------------------------------------
// Tipos de obra e locais (Q10, Q18)
// ---------------------------------------------------------------------------
export type TipoObra =
  | 'casa_terrea'
  | 'geminadas'
  | 'sobrado'
  | 'predio_3_6'
  | 'predio_7_mais'
  | 'comercial';

export type TipoPavimento =
  | 'subsolo_garagem'
  | 'terreo'
  | 'terreo_comercial'
  | 'tipo'
  | 'cobertura'
  | 'casa_maquinas';

/** Onde uma atividade acontece: a obra inteira, um pavimento (prédio/sobrado) ou uma unidade (geminadas). */
export interface Local {
  id: string;
  nome: string; // "Obra toda", "Térreo", "3º pavimento", "Casa 2"
  tipo: 'obra' | 'pavimento' | 'unidade';
  tipoPavimento?: TipoPavimento;
  ordem: number;
}

// ---------------------------------------------------------------------------
// EAP Caixa: 20 itens nível 1 (Q17)
// ---------------------------------------------------------------------------
export interface EtapaReferencia {
  codigo: number; // 1..20
  nome: string;
  /** Faixa de incidência recomendada no custo (%), Caixa COT PF v33 Anexo III. null = sem referência. */
  faixaMin: number | null;
  faixaMax: number | null;
  fonte: string;
}

// ---------------------------------------------------------------------------
// Modelos por tipo de obra (Q3 do wizard, Q19, Q20)
// ---------------------------------------------------------------------------
export interface ModeloAtividade {
  codigo: string; // ex.: "3.02"
  nome: string;
  etapaCodigo: number;
  /** Peso dentro da etapa (0..1). As atividades de uma etapa somam 1. Vem do Anexo IV da Caixa quando existe. */
  pesoNaEtapa: number;
  /** Duração em dias úteis POR LOCAL (se porLocal) ou para a obra toda. */
  duracaoDiasUteis: number;
  /** true = desdobra em um item por pavimento/unidade. */
  porLocal: boolean;
  /** Se porLocal, em quais tipos de pavimento a atividade existe. Vazio/undefined = todos. */
  tiposPavimento?: TipoPavimento[];
  /** Códigos de atividades que precisam terminar (no mesmo local, quando ambas são porLocal) antes desta começar. */
  predecessoras: string[];
  /** false = duração estimada, NÃO CONFIRMADO (Q20). */
  duracaoConfirmada: boolean;
  fonte?: string;
  /**
   * (Adicionado pela Fundação) Só gera a atividade se a obra tiver pelo menos este nº de pavimentos
   * (contando todos menos subsolo e casa de máquinas). Ex.: elevador no prédio 3-6 = 5 (Brusque, LC 417/2024, art. 118).
   */
  minPavimentos?: number;
}

export interface ModeloObra {
  tipo: TipoObra;
  nome: string;
  descricao: string;
  /** Como os locais são gerados a partir dos parâmetros do wizard. */
  desdobramento: 'nenhum' | 'pavimentos' | 'unidades';
  /** Códigos (1..20) das etapas Caixa que este tipo usa. */
  etapasAtivas: number[];
  /** % do orçamento por etapa usado como ESTIMATIVA inicial (ponto médio da faixa, normalizado para somar 100). */
  distribuicaoPadrao: Record<number, number>;
  atividades: ModeloAtividade[];
}

/** Parâmetros que o wizard coleta para gerar uma obra a partir de um modelo. */
export interface ParametrosNovaObra {
  nome: string;
  tipo: TipoObra;
  endereco: string;
  cidade: string;
  areaM2: number;
  dataInicio: ISODate;
  orcamentoTotal: number;
  engenheiroId: string;
  encarregadoId: string;
  /** Prédios/sobrado: lista de pavimentos em ordem de baixo para cima. */
  pavimentos?: { nome: string; tipoPavimento: TipoPavimento }[];
  /** Geminadas: quantidade de unidades. */
  unidades?: number;
}

// ---------------------------------------------------------------------------
// Obra instanciada
// ---------------------------------------------------------------------------
export type StatusObra = 'planejamento' | 'em_andamento' | 'pausada' | 'concluida';

/** Uma atividade num local: é a menor unidade medida (onde o encarregado lança %). */
export interface ItemAtividade {
  id: string;
  localId: string;
  /** Datas planejadas ATUAIS (rascunho / replanejamento). A régua de atraso usa a baseline vigente. */
  inicioPlanejado: ISODate;
  fimPlanejado: ISODate;
  inicioReal?: ISODate;
  fimReal?: ISODate;
  percentual: number; // 0..100, último apontamento
  valorOrcado: number; // R$ deste item (peso = valorOrcado / orcamentoTotal) (Q6)
}

export interface Atividade {
  id: string;
  codigo: string;
  nome: string;
  etapaCodigo: number;
  duracaoConfirmada: boolean;
  itens: ItemAtividade[];
}

export interface EtapaObra {
  codigo: number;
  nome: string;
  valorOrcado: number;
  /** true = valor ainda é a estimativa do modelo (Q19). */
  valorEstimado: boolean;
  atividades: Atividade[];
}

/** Baseline congelada (Q8). Guarda datas e valores de cada item no momento do congelamento. */
export interface Baseline {
  versao: number; // 1, 2, 3...
  congeladaEm: ISODate;
  autorId: string;
  justificativa?: string; // obrigatória a partir da v2
  itens: Record<string, { inicio: ISODate; fim: ISODate; valor: number }>; // chave = ItemAtividade.id
}

export interface Apontamento {
  id: string;
  itemId: string; // ItemAtividade.id
  data: ISODate;
  percentualAnterior: number;
  percentualNovo: number;
  observacao?: string;
  fotos: string[]; // no mock: nomes de arquivo fake (Q11)
  autorId: string;
}

export interface Obra {
  id: string;
  nome: string;
  tipo: TipoObra;
  endereco: string;
  cidade: string;
  areaM2: number;
  status: StatusObra;
  dataInicio: ISODate;
  orcamentoTotal: number;
  engenheiroId: string;
  encarregadoId: string;
  locais: Local[];
  etapas: EtapaObra[];
  baselines: Baseline[]; // vazio = ainda em planejamento, sem baseline
  apontamentos: Apontamento[];
  /** (Banco/API) Trava otimista: o PUT manda a revisão que leu; se outra pessoa salvou antes, a API responde 409. */
  revisao?: number;
  /** (Banco/API) Obra de demonstração ("Restaurar dados de exemplo" só mexe nestas). */
  exemplo?: boolean;
}

// ---------------------------------------------------------------------------
// Saídas do motor de cálculo
// ---------------------------------------------------------------------------
export type FaixaSaude = 'adiantada' | 'no_prazo' | 'atencao' | 'atrasada' | 'nao_iniciada' | 'concluida';
// Régua (Q15): SPI > 1,00 adiantada · >= 0,95 no_prazo · 0,85..0,94 atencao · < 0,85 atrasada.
// Cores: adiantada/no_prazo = verde, atencao = amarelo, atrasada = vermelho, nao_iniciada = cinza, concluida = azul.

export interface Indicadores {
  /** Fração 0..1, ponderada por valor. */
  realizado: number;
  /** Fração 0..1 contra a baseline vigente, proporcional a dias úteis (Q14). */
  planejado: number;
  /** realizado / planejado. null quando planejado = 0. */
  spi: number | null;
  /** (realizado - planejado) em pontos percentuais. */
  desvioPP: number;
  /** |desvioPP| > 10 (critério Caixa). */
  alertaCaixa: boolean;
  faixa: FaixaSaude;
  /** R$ agregado (valor orçado × % realizado) e R$ previsto até a data. (Q7) */
  valorAgregado: number;
  valorPlanejado: number;
}

export interface PontoCurvaS {
  data: ISODate; // fim de semana/mês
  previsto: number; // fração acumulada 0..1 (baseline)
  realizado: number | null; // null para datas futuras
  previstoValor: number; // R$ acumulado
  realizadoValor: number | null;
}
