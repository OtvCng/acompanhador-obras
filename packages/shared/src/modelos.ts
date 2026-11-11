/**
 * EAP Caixa (20 itens) + 6 modelos por tipo + gerador de obra (contrato).
 * Conteúdo preenchido pelo terminal Fundação a partir da pesquisa
 * otavio-vault/projetos/acompanhador-obras/pesquisa/2026-11-07-etapas-por-tipo-de-obra.md
 *
 * Regras:
 * - Faixas por etapa: Caixa COT PF v33, Anexo III (tabela de unidade isolada; para prédio e comercial é só referência).
 * - Pesos das atividades: Anexo IV quando existe; senão estimativa (estrutura técnica geral).
 * - Durações: todas NÃO CONFIRMADAS (duracaoConfirmada = false), exceto o ciclo de laje de 9 dias do prédio 7+.
 */
import type {
  EtapaReferencia, ModeloObra, ModeloAtividade, TipoObra, ParametrosNovaObra, Obra, Baseline, ISODate,
  Local, TipoPavimento, EtapaObra, Atividade, ItemAtividade,
} from './types';
import { addDiasUteis, proximoDiaUtil } from './calculo';

// ---------------------------------------------------------------------------
// Fontes
// ---------------------------------------------------------------------------
const URL_COT = 'https://metodopastori.com.br/COT_Construcao_PF_v33.pdf';
const F_COT3 = `Caixa COT PF v33, Anexo III, faixa recomendada (${URL_COT})`;
const F_ANEXO4 = `Peso: Caixa COT PF v33, Anexo IV (${URL_COT}). Duração NÃO CONFIRMADA.`;
const F_ANEXO4_RENORM = `Peso: Caixa COT PF v33, Anexo IV, renormalizado sem rebaixamento do lençol e escoramento (${URL_COT}). Duração NÃO CONFIRMADA.`;
const F_GERAL = 'Estrutura técnica geral (pesquisa de etapas, 2026-11-07). Peso e duração NÃO CONFIRMADOS.';
const F_CICLO =
  'Ciclo de laje de 9 dias por pavimento-tipo: Melo Neto & Araruna, CONIMAS 2019 (https://editorarealize.com.br/editora/anais/conimas-e-conidis/2019/TRABALHO_EV133_MD1_SA_ID1700_12112019083708.pdf). Peso: Anexo IV (proporcional ao nº de pavimentos).';
const F_CICLO_36 =
  'Ciclo de 9 dias vem de prédio alto (CONIMAS 2019); no prédio de 4 pavimentos da UFSC 2014 o ciclo foi ~35 dias úteis por nível. Duração NÃO CONFIRMADA. Peso: Anexo IV (proporcional ao nº de pavimentos).';
const F_BRUSQUE =
  'Elevador obrigatório a partir de 5 pavimentos em Brusque: LC 417/2024, art. 118 (https://leismunicipais.com.br/codigo-de-obras-brusque-sc-2024-08-19-versao-original). Duração NÃO CONFIRMADA (Pollo Elevadores, fonte fraca).';
const F_GALPAO =
  'Fabricação em paralelo com a fundação: MontQualy e Calculobra (blogs, fonte fraca). Peso e duração NÃO CONFIRMADOS.';

// ---------------------------------------------------------------------------
// EAP Caixa nível 1 (seção 2.1 da pesquisa)
// ---------------------------------------------------------------------------
const ref = (codigo: number, nome: string, faixaMin: number, faixaMax: number): EtapaReferencia => ({
  codigo, nome, faixaMin, faixaMax, fonte: F_COT3,
});

export const ETAPAS_CAIXA: EtapaReferencia[] = [
  ref(1, 'Serviços preliminares e gerais', 1.13, 3.97),
  ref(2, 'Infraestrutura', 3.07, 7.43),
  ref(3, 'Supraestrutura', 12.17, 17.67),
  ref(4, 'Paredes e painéis', 4.8, 10.67),
  ref(5, 'Esquadrias', 4.16, 13.27),
  ref(6, 'Vidros e plásticos', 0, 2.45),
  ref(7, 'Coberturas', 0, 12.94),
  ref(8, 'Impermeabilizações', 0, 10.1),
  ref(9, 'Revestimentos internos', 6.81, 9.32),
  ref(10, 'Forros', 0, 2.18),
  ref(11, 'Revestimentos externos', 3.87, 5.3),
  ref(12, 'Pisos', 8.41, 11.51),
  ref(13, 'Pintura', 3.63, 6.47),
  ref(14, 'Acabamentos', 1.01, 1.38),
  ref(15, 'Instalações elétricas e telefônicas', 3.75, 4.85),
  ref(16, 'Instalações hidráulicas', 3.63, 4.27),
  ref(17, 'Instalações de esgoto e águas pluviais', 3.65, 4.3),
  ref(18, 'Louças e metais', 4.14, 4.87),
  ref(19, 'Complementos', 0.24, 2.29),
  ref(20, 'Outros serviços', 0, 10),
];

const TODAS_ETAPAS = ETAPAS_CAIXA.map((e) => e.codigo);

/** Ponto médio das faixas Caixa nas etapas ativas, normalizado para somar exatamente 100 (2 casas). */
export function distribuicaoPorPontoMedio(etapasAtivas: number[]): Record<number, number> {
  const meios = etapasAtivas.map((c) => {
    const r = ETAPAS_CAIXA.find((e) => e.codigo === c);
    return r && r.faixaMin !== null && r.faixaMax !== null ? (r.faixaMin + r.faixaMax) / 2 : 0;
  });
  const valores = ratear(100, meios);
  const out: Record<number, number> = {};
  etapasAtivas.forEach((c, i) => { out[c] = valores[i]; });
  return out;
}

// ---------------------------------------------------------------------------
// Helpers de rateio (centavos exatos, maior resto)
// ---------------------------------------------------------------------------
/** Divide `total` (2 casas) proporcionalmente aos pesos, garantindo que a soma seja exatamente `total`. */
export function ratear(total: number, pesos: number[]): number[] {
  if (pesos.length === 0) return [];
  const cents = Math.round(total * 100);
  let soma = pesos.reduce((s, p) => s + Math.max(0, p), 0);
  const ws = soma > 0 ? pesos.map((p) => Math.max(0, p)) : pesos.map(() => 1);
  if (soma <= 0) soma = ws.length;
  const brutos = ws.map((w) => (cents * w) / soma);
  const base = brutos.map(Math.floor);
  let resto = cents - base.reduce((s, b) => s + b, 0);
  const ordem = brutos.map((b, i) => ({ i, f: b - Math.floor(b) })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (let k = 0; resto > 0 && ordem.length > 0; k = (k + 1) % ordem.length, resto--) base[ordem[k].i]++;
  return base.map((c) => c / 100);
}

// ---------------------------------------------------------------------------
// Construtores de atividades
// ---------------------------------------------------------------------------
type Op = Partial<Pick<ModeloAtividade, 'porLocal' | 'tiposPavimento' | 'duracaoConfirmada' | 'fonte' | 'minPavimentos'>>;

function at(
  codigo: string, nome: string, etapaCodigo: number, pesoNaEtapa: number, duracaoDiasUteis: number,
  predecessoras: string[], op: Op = {},
): ModeloAtividade {
  return {
    codigo, nome, etapaCodigo, pesoNaEtapa, duracaoDiasUteis,
    porLocal: op.porLocal ?? false,
    ...(op.tiposPavimento ? { tiposPavimento: op.tiposPavimento } : {}),
    predecessoras,
    duracaoConfirmada: op.duracaoConfirmada ?? false,
    fonte: op.fonte ?? F_GERAL,
    ...(op.minPavimentos ? { minPavimentos: op.minPavimentos } : {}),
  };
}

/** Casa térrea, geminadas (por unidade) e sobrado (por pavimento). */
function residencial(kind: 'casa' | 'geminadas' | 'sobrado'): ModeloAtividade[] {
  const gem = kind === 'geminadas';
  const sob = kind === 'sobrado';
  /** flags: 'u' = repete por unidade nas geminadas; 'p' = repete por pavimento no sobrado. */
  const r = (
    codigo: string, nome: string, etapa: number, peso: number, durCasa: number, preds: string[],
    flags: string, fonte?: string,
  ) => {
    const porLocal = (gem && flags.includes('u')) || (sob && flags.includes('p'));
    const fator = !porLocal ? 1 : gem ? 0.7 : 0.8;
    return at(codigo, nome, etapa, peso, Math.max(1, Math.round(durCasa * fator)), preds, { porLocal, fonte });
  };
  const banheiros = sob ? [0.35, 0.65] : [0.45, 0.55];
  const fimEstrutura = sob ? '3.01' : '3.03';

  const estrutura: ModeloAtividade[] = sob
    ? [
        r('3.01', 'Estrutura do pavimento (pilares, vigas e laje)', 3, 0.8, 25, ['2.03', '8.01'], 'p',
          `Peso estimado; Anexo IV manda medir a supraestrutura proporcionalmente ao nº de pavimentos (${URL_COT}). Duração NÃO CONFIRMADA.`),
        r('3.02', 'Vergas e contravergas', 3, 0.05, 4, ['4.01'], 'p'),
        r('3.03', 'Escada (estrutura)', 3, 0.15, 6, ['3.01'], ''),
        r('4.01', 'Alvenaria (marcação, elevação e encunhamento)', 4, 1, 25, ['3.01'], 'p',
          `Anexo IV: alvenaria medida proporcionalmente ao nº de pavimentos (${URL_COT}). Duração NÃO CONFIRMADA.`),
        r('15.01', 'Tubulação elétrica nas lajes', 15, 0.3, 3, ['3.01'], 'p', F_ANEXO4),
      ]
    : [
        r('3.01', 'Pilares e vigas', 3, 0.5, 12, ['2.03', '8.01'], 'u'),
        r('3.02', 'Vergas e contravergas', 3, 0.1, 3, ['4.01'], 'u'),
        r('3.03', 'Laje de forro', 3, 0.4, 8, ['4.01', '15.01'], 'u'),
        r('4.01', 'Alvenaria (marcação, elevação e encunhamento)', 4, 1, 18, ['3.01'], 'u'),
        r('15.01', 'Tubulação elétrica nas lajes', 15, 0.3, 2, ['4.01'], 'u', F_ANEXO4),
      ];

  return [
    r('1.01', 'Projetos, aprovações e alvará', 1, 0.3, 10, [], ''),
    r('1.02', 'Canteiro, tapume e ligações provisórias', 1, 0.4, 5, ['1.01'], ''),
    r('1.03', 'Limpeza do terreno e locação da obra', 1, 0.3, 3, ['1.02'], ''),
    r('2.01', 'Escavação', 2, 8 / 88, 3, ['1.03'], 'u', F_ANEXO4_RENORM),
    r('2.02', 'Fundação (estacas ou sapatas)', 2, 60 / 88, 8, ['2.01'], 'u', F_ANEXO4_RENORM),
    r('2.03', 'Vigas baldrame e cintas', 2, 20 / 88, 6, ['2.02'], 'u', F_ANEXO4_RENORM),
    ...estrutura,
    r('5.01', 'Contramarcos e aduelas', 5, 0.3, 2, ['4.01'], 'up', F_ANEXO4),
    r('5.02', 'Folhas de janelas e portas', 5, 0.7, 5, ['12.02'], 'up', F_ANEXO4),
    r('6.01', 'Vidros', 6, 1, 2, ['5.02'], 'up'),
    r('7.01', 'Madeiramento do telhado', 7, 0.45, 6, [fimEstrutura], 'u', F_ANEXO4),
    r('7.02', 'Telhamento', 7, 0.45, 5, ['7.01'], 'u', F_ANEXO4),
    r('7.03', 'Rufos, calhas e arremates', 7, 0.1, 2, ['7.02'], 'u', F_ANEXO4),
    r('8.01', 'Impermeabilização do baldrame', 8, 0.4, 2, ['2.03'], 'u'),
    r('8.02', 'Impermeabilização de áreas molhadas', 8, 0.6, 3, ['9.02'], 'up'),
    r('9.01', 'Chapisco interno', 9, 0.1, 3, ['7.02', '15.02', '16.02', '17.02'], 'up', F_ANEXO4),
    r('9.02', 'Emboço interno', 9, 0.2, 8, ['9.01'], 'up', F_ANEXO4),
    r('9.03', 'Reboco ou gesso interno', 9, 0.7, 8, ['9.02'], 'up', F_ANEXO4),
    r('10.01', 'Forro', 10, 1, 4, ['9.03'], 'up'),
    r('11.01', 'Chapisco externo', 11, 0.2, 2, ['7.02'], 'u', F_ANEXO4),
    r('11.02', sob ? 'Emboço externo com andaime (reboco pronto)' : 'Emboço externo (reboco pronto)', 11, 0.8, 8, ['11.01'], 'u', F_ANEXO4),
    r('12.01', 'Contrapiso', 12, 0.35, 4, ['9.03', '8.02', '16.01', '17.01'], 'up', F_ANEXO4),
    r('12.02', 'Revestimento de piso', 12, 0.65, 8, ['12.01'], 'up', F_ANEXO4),
    r('13.01', 'Emassamento', 13, 0.6, 6, ['10.01', '12.02'], 'up', F_ANEXO4),
    r('13.02', 'Pintura: 1ª demão', 13, 0.2, 3, ['13.01', '11.02'], 'up', F_ANEXO4),
    r('13.03', 'Pintura: 2ª demão', 13, 0.2, 3, ['13.02'], 'up', F_ANEXO4),
    r('14.01', 'Rodapés, soleiras e peitoris', 14, 0.5, 3, ['12.02'], 'up'),
    r('14.02', 'Ferragens (dobradiças, fechaduras e maçanetas)', 14, 0.5, 2, ['5.02'], 'up'),
    r('15.02', 'Tubulação elétrica nas alvenarias e caixas', 15, 0.3, 6, ['4.01'], 'up', F_ANEXO4),
    r('15.03', 'Enfiação', 15, 0.2, 4, ['9.03'], 'up', F_ANEXO4),
    r('15.04', 'Disjuntores, tomadas e interruptores', 15, 0.1, 2, ['13.02'], 'up', F_ANEXO4),
    r('15.05', 'Entrada de energia e quadros', 15, 0.1, 2, ['15.03'], 'u', F_ANEXO4),
    r('16.01', 'Tubulação de água no piso', 16, 0.2, 2, ['2.03'], 'u', F_ANEXO4),
    r('16.02', 'Tubulação de água nas alvenarias', 16, 0.7, 5, ['4.01'], 'up', F_ANEXO4),
    r('16.03', "Caixa d'água", 16, 0.1, 1, ['7.02'], 'u', F_ANEXO4),
    r('17.01', 'Tubulação de esgoto no piso', 17, 0.2, 2, ['2.03'], 'u', F_ANEXO4),
    r('17.02', 'Esgoto e águas pluviais nas alvenarias', 17, 0.7, 4, ['4.01'], 'up', F_ANEXO4),
    r('17.03', 'Caixas de inspeção, gordura e pluviais', 17, 0.1, 2, ['7.03'], 'u',
      `Peso: Anexo IV (o 3º item aparece como "caixa d'água" no documento) (${URL_COT}). Duração NÃO CONFIRMADA.`),
    r('18.01', 'Louças e metais da cozinha e área de serviço', 18, banheiros[0], 2, ['13.02'], 'up', F_ANEXO4),
    r('18.02', 'Louças e metais dos banheiros', 18, banheiros[1], 2, ['13.02'], 'up', F_ANEXO4),
    r('19.01', gem ? 'Muro, calçadas e acessos do conjunto' : 'Calçadas, muros e paisagismo', 19, 0.6, 6, ['11.02'], ''),
    r('19.02', gem ? 'Ligações definitivas coletivas (água, esgoto e energia)' : 'Ligações definitivas (água, esgoto e energia)', 19, 0.4, 3, ['15.05', '17.03'], ''),
    r('20.01', 'Limpeza final e entrega', 20, 0.6, 3,
      ['13.03', '18.01', '18.02', '15.04', '6.01', '14.01', '14.02', '19.01', '19.02'], ''),
    r('20.02', 'Habite-se e documentação final', 20, 0.4, 5, ['20.01'], ''),
  ];
}

const PAV_ACABADOS: TipoPavimento[] = ['terreo', 'terreo_comercial', 'tipo', 'cobertura'];
const PAV_ESTRUTURA: TipoPavimento[] = ['subsolo_garagem', 'terreo', 'terreo_comercial', 'tipo', 'cobertura', 'casa_maquinas'];
const PAV_OCUPADOS: TipoPavimento[] = ['subsolo_garagem', 'terreo', 'terreo_comercial', 'tipo', 'cobertura'];

/** Prédio 3-6 (alto = false) e 7+ (alto = true): atividades por pavimento, estrutura no caminho crítico. */
function predio(alto: boolean): ModeloAtividade[] {
  const pl = (tiposPavimento: TipoPavimento[], fonte?: string): Op => ({ porLocal: true, tiposPavimento, fonte });
  const h = (alto7: number, baixo: number) => (alto ? alto7 : baixo);
  return [
    at('1.01', 'Projetos, aprovações e alvará', 1, 0.25, h(20, 15), []),
    at('1.02', 'Canteiro, tapume, instalações provisórias e guincho', 1, 0.45, h(10, 8), ['1.01']),
    at('1.03', 'Locação da obra', 1, 0.3, 5, ['1.02']),
    at('2.01', 'Escoramento dos vizinhos e contenção', 2, 0.04, h(10, 6), ['1.03'], { fonte: F_ANEXO4 }),
    at('2.02', 'Rebaixamento do lençol freático', 2, 0.08, h(10, 5), ['2.01'], { fonte: F_ANEXO4 }),
    at('2.03', 'Estaqueamento', 2, 0.6, h(20, 12), ['1.03'], { fonte: F_ANEXO4 }),
    at('2.04', 'Escavação', 2, 0.08, h(10, 5), ['2.02', '2.03'], { fonte: F_ANEXO4 }),
    at('2.05', 'Blocos, baldrames, cintas e cortinas', 2, 0.2, h(15, 10), ['2.04'], { fonte: F_ANEXO4 }),
    at('3.01', 'Estrutura do pavimento (fôrmas, armação, concretagem e desforma)', 3, 0.9, 9, ['2.05', '8.01'], {
      ...pl(PAV_ESTRUTURA, alto ? F_CICLO : F_CICLO_36), duracaoConfirmada: alto,
    }),
    at('3.02', 'Escadas', 3, 0.1, 3, ['3.01'], pl(PAV_OCUPADOS)),
    at('4.01', 'Alvenaria de vedação', 4, 1, 12, ['3.01'], pl(PAV_OCUPADOS,
      `Peso: Anexo IV, alvenaria proporcional ao nº de pavimentos (${URL_COT}). Duração NÃO CONFIRMADA.`)),
    at('5.01', 'Contramarcos e aduelas', 5, 0.3, 4, ['4.01'], pl(PAV_ACABADOS, F_ANEXO4)),
    at('5.02', 'Folhas de janelas e portas', 5, 0.6, 5, ['12.02'], pl(PAV_ACABADOS, F_ANEXO4)),
    at('5.03', 'Vitrines e portas de enrolar das lojas', 5, 0.1, 6, ['12.02'], pl(['terreo_comercial'])),
    at('6.01', 'Vidros', 6, 1, 3, ['5.02'], pl(PAV_ACABADOS)),
    at('7.01', 'Estrutura da cobertura (madeiramento)', 7, 0.45, 5, ['3.01'], { fonte: F_ANEXO4 }),
    at('7.02', 'Telhamento', 7, 0.45, 4, ['7.01'], { fonte: F_ANEXO4 }),
    at('7.03', 'Rufos, calhas e arremates', 7, 0.1, 3, ['7.02'], { fonte: F_ANEXO4 }),
    at('8.01', 'Impermeabilização de fundações e baldrames', 8, 0.3, 5, ['2.05']),
    at('8.02', 'Impermeabilização de áreas molhadas', 8, 0.4, 3, ['9.02'], pl(PAV_ACABADOS)),
    at('8.03', 'Impermeabilização de lajes descobertas e reservatório', 8, 0.3, 5, ['3.01'], pl(['cobertura', 'casa_maquinas'])),
    at('9.01', 'Chapisco interno', 9, 0.1, 3, ['4.01', '15.02', '16.02', '17.02'], pl(PAV_OCUPADOS, F_ANEXO4)),
    at('9.02', 'Emboço interno', 9, 0.2, 6, ['9.01'], pl(PAV_OCUPADOS, F_ANEXO4)),
    at('9.03', 'Reboco ou gesso interno', 9, 0.7, 6, ['9.02'], pl(PAV_OCUPADOS, F_ANEXO4)),
    at('10.01', 'Forro de gesso', 10, 1, 4, ['9.03'], pl(PAV_ACABADOS)),
    at('11.01', 'Chapisco de fachada', 11, 0.2, h(15, 10), ['4.01', '7.02'], { fonte: F_ANEXO4 }),
    at('11.02', 'Emboço e revestimento de fachada (balancim)', 11, 0.8, h(50, 30), ['11.01'], { fonte: F_ANEXO4 }),
    at('12.01', 'Contrapiso', 12, 0.315, 4, ['9.03', '8.02'], pl(PAV_ACABADOS,
      `Peso: Anexo IV (contrapiso 35 / revestimento 65) aplicado a 90% da etapa (${URL_COT}). Duração NÃO CONFIRMADA.`)),
    at('12.02', 'Revestimento de piso', 12, 0.585, 6, ['12.01'], pl(PAV_ACABADOS,
      `Peso: Anexo IV (contrapiso 35 / revestimento 65) aplicado a 90% da etapa (${URL_COT}). Duração NÃO CONFIRMADA.`)),
    at('12.03', 'Piso de concreto da garagem e demarcação', 12, 0.1, 6, ['9.03'], pl(['subsolo_garagem'])),
    at('13.01', 'Emassamento', 13, 0.48, 5, ['10.01', '12.02'], pl(PAV_ACABADOS,
      `Peso: Anexo IV (60/20/20) aplicado a 80% interna; 20% de fachada é estimativa (${URL_COT}). Duração NÃO CONFIRMADA.`)),
    at('13.02', 'Pintura interna: 1ª demão', 13, 0.16, 3, ['13.01'], pl(PAV_ACABADOS, F_ANEXO4)),
    at('13.03', 'Pintura interna: 2ª demão', 13, 0.16, 3, ['13.02'], pl(PAV_ACABADOS, F_ANEXO4)),
    at('13.04', 'Pintura de fachada', 13, 0.2, h(20, 12), ['11.02']),
    at('14.01', 'Rodapés, soleiras e peitoris', 14, 0.5, 3, ['12.02'], pl(PAV_ACABADOS)),
    at('14.02', 'Ferragens (dobradiças, fechaduras e maçanetas)', 14, 0.5, 2, ['5.02'], pl(PAV_ACABADOS)),
    at('15.01', 'Tubulação elétrica nas lajes e prumadas', 15, 0.3, 2, ['3.01'], pl(PAV_OCUPADOS, F_ANEXO4)),
    at('15.02', 'Tubulação elétrica nas alvenarias e caixas', 15, 0.3, 5, ['4.01'], pl(PAV_OCUPADOS, F_ANEXO4)),
    at('15.03', 'Enfiação', 15, 0.2, 4, ['9.03'], pl(PAV_OCUPADOS, F_ANEXO4)),
    at('15.04', 'Disjuntores, tomadas e interruptores', 15, 0.1, 3, ['13.02'], pl(PAV_ACABADOS, F_ANEXO4)),
    at('15.05', 'Entrada de energia, medidores e quadros', 15, 0.1, 10, ['15.03'], { fonte: F_ANEXO4 }),
    at('16.01', 'Prumadas e tubulação de água no piso', 16, 0.2, 2, ['3.01'], pl(PAV_OCUPADOS, F_ANEXO4)),
    at('16.02', 'Tubulação de água nas alvenarias', 16, 0.7, 4, ['4.01'], pl(PAV_ACABADOS, F_ANEXO4)),
    at('16.03', 'Reservatório superior e barrilete', 16, 0.1, 8, ['3.01'], { fonte: F_ANEXO4 }),
    at('17.01', 'Prumadas e tubulação de esgoto no piso', 17, 0.2, 2, ['3.01'], pl(PAV_OCUPADOS, F_ANEXO4)),
    at('17.02', 'Esgoto e águas pluviais nas alvenarias', 17, 0.7, 4, ['4.01'], pl(PAV_ACABADOS, F_ANEXO4)),
    at('17.03', 'Caixas de inspeção, gordura e ligações', 17, 0.1, 6, ['17.01'], { fonte: F_ANEXO4 }),
    at('18.01', 'Louças e metais de cozinhas e áreas de serviço', 18, 0.35, 2, ['13.02'], pl(['tipo', 'cobertura'], F_ANEXO4)),
    at('18.02', 'Louças e metais dos banheiros', 18, 0.65, 3, ['13.02'], pl(PAV_ACABADOS, F_ANEXO4)),
    at('19.01', 'Áreas comuns, calçadas e paisagismo', 19, 0.5, 15, ['11.02']),
    at('19.02', 'Ligações definitivas (água, esgoto e energia)', 19, 0.25, 5, ['15.05', '17.03']),
    at('19.03', 'Portão e acessos da garagem', 19, 0.25, 5, ['12.03'], pl(['subsolo_garagem'])),
    at('20.01', 'Elevador: poço, guias, cabine, máquina e testes', 20, 0.45, h(60, 50), ['3.01', '15.05'], {
      fonte: F_BRUSQUE, ...(alto ? {} : { minPavimentos: 5 }),
    }),
    at('20.02', 'Preventivo de incêndio (PPCI)', 20, 0.25, 15, ['15.03']),
    at('20.03', 'Limpeza final', 20, 0.15, 5,
      ['13.03', '13.04', '18.01', '18.02', '15.04', '6.01', '14.01', '14.02', '19.01', '19.02', '19.03', '5.03']),
    at('20.04', 'Vistoria, habite-se e entrega', 20, 0.15, 10, ['20.01', '20.02', '20.03']),
  ];
}

/** Loja térrea / galpão: obra toda num local só, fabricação da estrutura em paralelo com a fundação. */
function comercial(): ModeloAtividade[] {
  return [
    at('1.01', 'Projetos, aprovações e PPCI (bombeiros)', 1, 0.4, 15, []),
    at('1.02', 'Canteiro e ligações provisórias', 1, 0.3, 5, ['1.01']),
    at('1.03', 'Terraplenagem e locação', 1, 0.3, 8, ['1.02']),
    at('2.01', 'Escavação', 2, 8 / 88, 3, ['1.03'], { fonte: F_ANEXO4_RENORM }),
    at('2.02', 'Fundação (sapatas ou estacas)', 2, 60 / 88, 10, ['2.01'], { fonte: F_ANEXO4_RENORM }),
    at('2.03', 'Blocos, baldrames e cintas', 2, 20 / 88, 8, ['2.02'], { fonte: F_ANEXO4_RENORM }),
    at('3.01', 'Fabricação da estrutura (metálica ou pré-moldada)', 3, 0.5, 30, ['1.01'], { fonte: F_GALPAO }),
    at('3.02', 'Montagem da estrutura', 3, 0.5, 15, ['2.03', '3.01'], { fonte: F_GALPAO }),
    at('4.01', 'Fechamento lateral (alvenaria ou painel)', 4, 1, 15, ['7.02']),
    at('5.01', 'Contramarcos e aduelas', 5, 0.3, 3, ['4.01'], { fonte: F_ANEXO4 }),
    at('5.02', 'Fachada comercial, vitrines, portas de enrolar e portões', 5, 0.7, 8, ['12.02']),
    at('6.01', 'Vidros', 6, 1, 3, ['5.02']),
    at('7.01', 'Estrutura da cobertura (terças)', 7, 0.45, 6, ['3.02'], { fonte: F_ANEXO4 }),
    at('7.02', 'Telhas (sanduíche ou metálica)', 7, 0.45, 8, ['7.01'], { fonte: F_ANEXO4 }),
    at('7.03', 'Calhas, rufos e lanternim', 7, 0.1, 4, ['7.02'], { fonte: F_ANEXO4 }),
    at('8.01', 'Impermeabilização de baldrames', 8, 0.5, 2, ['2.03']),
    at('8.02', 'Impermeabilização de áreas molhadas', 8, 0.5, 2, ['9.02']),
    at('9.01', 'Chapisco interno', 9, 0.1, 2, ['4.01', '15.02', '16.02', '17.02'], { fonte: F_ANEXO4 }),
    at('9.02', 'Emboço interno', 9, 0.2, 5, ['9.01'], { fonte: F_ANEXO4 }),
    at('9.03', 'Reboco ou gesso interno', 9, 0.7, 5, ['9.02'], { fonte: F_ANEXO4 }),
    at('10.01', 'Forro da área administrativa', 10, 1, 5, ['9.03']),
    at('11.01', 'Chapisco externo', 11, 0.2, 2, ['4.01'], { fonte: F_ANEXO4 }),
    at('11.02', 'Revestimento de fachada', 11, 0.8, 8, ['11.01'], { fonte: F_ANEXO4 }),
    at('12.01', 'Base e sub-base do piso industrial', 12, 0.35, 5, ['7.02', '4.01', '16.01', '17.01'], {
      fonte: `Peso: Anexo IV (contrapiso 35 / revestimento 65) adaptado ao piso industrial (${URL_COT}). Duração NÃO CONFIRMADA.`,
    }),
    at('12.02', 'Piso industrial (armadura, concreto, juntas e acabamento)', 12, 0.65, 8, ['12.01'], {
      fonte: `Peso: Anexo IV (contrapiso 35 / revestimento 65) adaptado ao piso industrial (${URL_COT}). Duração NÃO CONFIRMADA.`,
    }),
    at('13.01', 'Emassamento', 13, 0.6, 5, ['9.03', '10.01', '12.02'], { fonte: F_ANEXO4 }),
    at('13.02', 'Pintura: 1ª demão', 13, 0.2, 3, ['13.01', '11.02'], { fonte: F_ANEXO4 }),
    at('13.03', 'Pintura: 2ª demão', 13, 0.2, 3, ['13.02'], { fonte: F_ANEXO4 }),
    at('14.01', 'Rodapés, soleiras e peitoris', 14, 0.5, 3, ['12.02']),
    at('14.02', 'Ferragens (dobradiças, fechaduras e maçanetas)', 14, 0.5, 2, ['5.02']),
    at('15.01', 'Eletrocalhas e infraestrutura elétrica na estrutura', 15, 0.3, 5, ['3.02']),
    at('15.02', 'Tubulação elétrica nas alvenarias e caixas', 15, 0.3, 5, ['4.01'], { fonte: F_ANEXO4 }),
    at('15.03', 'Enfiação e cabeamento', 15, 0.2, 6, ['9.03'], { fonte: F_ANEXO4 }),
    at('15.04', 'Iluminação, tomadas e disjuntores', 15, 0.1, 4, ['13.02'], { fonte: F_ANEXO4 }),
    at('15.05', 'Entrada de energia e quadros (carga alta)', 15, 0.1, 5, ['15.03'], { fonte: F_ANEXO4 }),
    at('16.01', 'Tubulação de água no piso', 16, 0.2, 3, ['2.03'], { fonte: F_ANEXO4 }),
    at('16.02', 'Tubulação de água nas alvenarias', 16, 0.7, 4, ['4.01'], { fonte: F_ANEXO4 }),
    at('16.03', "Reservatório (caixa d'água)", 16, 0.1, 2, ['3.02'], { fonte: F_ANEXO4 }),
    at('17.01', 'Tubulação de esgoto no piso', 17, 0.2, 3, ['2.03'], { fonte: F_ANEXO4 }),
    at('17.02', 'Esgoto e águas pluviais nas alvenarias e calhas', 17, 0.7, 4, ['4.01', '7.03'], { fonte: F_ANEXO4 }),
    at('17.03', 'Caixas de inspeção, gordura e ligações', 17, 0.1, 3, ['17.02'], { fonte: F_ANEXO4 }),
    at('18.01', 'Louças e metais da copa', 18, 0.45, 2, ['13.02'], { fonte: F_ANEXO4 }),
    at('18.02', 'Louças e metais dos banheiros e vestiários', 18, 0.55, 3, ['13.02'], { fonte: F_ANEXO4 }),
    at('19.01', 'Pátio, estacionamento e calçadas', 19, 0.6, 10, ['11.02']),
    at('19.02', 'Ligações definitivas (água, esgoto e energia)', 19, 0.4, 3, ['15.05', '17.03']),
    at('20.01', 'Instalações de incêndio (hidrantes e sprinklers, se exigidos)', 20, 0.4, 10, ['15.03']),
    at('20.02', 'Limpeza final', 20, 0.2, 3, ['13.03', '15.04', '6.01', '14.01', '14.02', '18.01', '18.02', '19.01', '19.02']),
    at('20.03', 'Vistoria dos bombeiros e habite-se', 20, 0.4, 10, ['20.01', '20.02']),
  ];
}

function modelo(tipo: TipoObra, descricao: string, desdobramento: ModeloObra['desdobramento'], atividades: ModeloAtividade[]): ModeloObra {
  return {
    tipo,
    nome: NOMES_TIPO[tipo],
    descricao,
    desdobramento,
    etapasAtivas: [...TODAS_ETAPAS],
    distribuicaoPadrao: distribuicaoPorPontoMedio(TODAS_ETAPAS),
    atividades,
  };
}

export const NOMES_TIPO: Record<TipoObra, string> = {
  casa_terrea: 'Casa térrea',
  geminadas: 'Casas geminadas',
  sobrado: 'Sobrado',
  predio_3_6: 'Prédio 3 a 6 pavimentos',
  predio_7_mais: 'Prédio 7+ pavimentos',
  comercial: 'Comercial térreo / galpão',
};

export const MODELOS: Record<TipoObra, ModeloObra> = {
  casa_terrea: modelo('casa_terrea',
    'Casa isolada de um pavimento. Rede de precedência simples, um local só.', 'nenhum', residencial('casa')),
  geminadas: modelo('geminadas',
    'Unidades repetidas executadas em série (linha de balanço): a casa seguinte começa cada serviço quando a anterior termina. Itens comuns (muro, ligações) na obra toda.',
    'unidades', residencial('geminadas')),
  sobrado: modelo('sobrado',
    'Térreo e pavimento superior em série para estrutura e alvenaria; acabamentos por pavimento depois da cobertura.',
    'pavimentos', residencial('sobrado')),
  predio_3_6: modelo('predio_3_6',
    'Atividades por pavimento com a estrutura no caminho crítico. Elevador só com 5 pavimentos ou mais (regra de Brusque).',
    'pavimentos', predio(false)),
  predio_7_mais: modelo('predio_7_mais',
    'Atividades por pavimento, ciclo de laje de 9 dias úteis, elevador, PPCI e fachada com balancim.',
    'pavimentos', predio(true)),
  comercial: modelo('comercial',
    'Loja térrea ou galpão num local só. Estrutura fabricada fora do canteiro, em paralelo com a fundação; piso industrial depois da cobertura.',
    'nenhum', comercial()),
};

// ---------------------------------------------------------------------------
// Locais
// ---------------------------------------------------------------------------
const PAVIMENTOS_PADRAO: Partial<Record<TipoObra, { nome: string; tipoPavimento: TipoPavimento }[]>> = {
  sobrado: [
    { nome: 'Térreo', tipoPavimento: 'terreo' },
    { nome: 'Pavimento superior', tipoPavimento: 'tipo' },
  ],
  predio_3_6: [
    { nome: 'Térreo', tipoPavimento: 'terreo' },
    { nome: '1º pavimento', tipoPavimento: 'tipo' },
    { nome: '2º pavimento', tipoPavimento: 'tipo' },
    { nome: '3º pavimento', tipoPavimento: 'tipo' },
    { nome: 'Cobertura', tipoPavimento: 'cobertura' },
  ],
  predio_7_mais: [
    { nome: 'Subsolo (garagem)', tipoPavimento: 'subsolo_garagem' },
    { nome: 'Térreo comercial', tipoPavimento: 'terreo_comercial' },
    ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ nome: `${n}º pavimento`, tipoPavimento: 'tipo' as TipoPavimento })),
    { nome: 'Cobertura', tipoPavimento: 'cobertura' },
    { nome: 'Casa de máquinas', tipoPavimento: 'casa_maquinas' },
  ],
};

/** Pavimentos padrão por tipo (o wizard pode usar como ponto de partida). */
export function pavimentosPadrao(tipo: TipoObra): { nome: string; tipoPavimento: TipoPavimento }[] {
  return (PAVIMENTOS_PADRAO[tipo] ?? []).map((p) => ({ ...p }));
}

/** Pavimentos que contam para regras municipais (todos menos subsolo e casa de máquinas). */
export function contarPavimentos(pavimentos: { tipoPavimento: TipoPavimento }[]): number {
  return pavimentos.filter((p) => p.tipoPavimento !== 'subsolo_garagem' && p.tipoPavimento !== 'casa_maquinas').length;
}

function gerarLocais(params: ParametrosNovaObra, modelo: ModeloObra, id: string): Local[] {
  const locais: Local[] = [{ id: `${id}-L0`, nome: 'Obra toda', tipo: 'obra', ordem: 0 }];
  if (modelo.desdobramento === 'pavimentos') {
    const pavs = params.pavimentos?.length ? params.pavimentos : pavimentosPadrao(params.tipo);
    pavs.forEach((p, i) => locais.push({
      id: `${id}-L${i + 1}`, nome: p.nome, tipo: 'pavimento', tipoPavimento: p.tipoPavimento, ordem: i + 1,
    }));
  } else if (modelo.desdobramento === 'unidades') {
    const n = Math.max(1, Math.round(params.unidades ?? 4));
    for (let i = 1; i <= n; i++) locais.push({ id: `${id}-L${i}`, nome: `Casa ${i}`, tipo: 'unidade', ordem: i });
  }
  return locais;
}

// ---------------------------------------------------------------------------
// Gerador de obra
// ---------------------------------------------------------------------------
interface Instancia { m: ModeloAtividade; locs: Local[] }

/** Gera a obra em status 'planejamento', sem baseline, com valores estimados (Q19) e datas pela rede de precedência. */
export function gerarObra(params: ParametrosNovaObra, id: string, modelo: ModeloObra = MODELOS[params.tipo]): Obra {
  const locais = gerarLocais(params, modelo, id);
  const localObra = locais[0];
  const sub = locais.slice(1);
  const nPav = modelo.desdobramento === 'pavimentos'
    ? contarPavimentos(sub.map((l) => ({ tipoPavimento: l.tipoPavimento ?? 'tipo' })))
    : 0;

  // 1) Instâncias (atividade × locais onde existe)
  const insts: Instancia[] = [];
  for (const m of modelo.atividades) {
    if (!modelo.etapasAtivas.includes(m.etapaCodigo)) continue;
    if (m.minPavimentos && modelo.desdobramento === 'pavimentos' && nPav < m.minPavimentos) continue;
    let locs: Local[];
    if (m.porLocal && sub.length > 0) {
      const tp = m.tiposPavimento;
      locs = sub.filter((l) => l.tipo !== 'pavimento' || !tp?.length || (l.tipoPavimento !== undefined && tp.includes(l.tipoPavimento)));
    } else {
      locs = [localObra];
    }
    if (locs.length > 0) insts.push({ m, locs });
  }
  const porCodigo = new Map(insts.map((i) => [i.m.codigo, i]));

  // 2) Datas pela rede de precedência + linha de balanço
  const fins = new Map<string, Map<string, ISODate>>(); // codigo -> localId -> fim
  const inicios = new Map<string, Map<string, ISODate>>();
  const inicioObra = proximoDiaUtil(params.dataInicio);
  const maxFim = (codigo: string): ISODate | undefined => {
    let f: ISODate | undefined;
    for (const d of fins.get(codigo)?.values() ?? []) if (!f || d > f) f = d;
    return f;
  };
  const estado = new Map<string, 'visitando' | 'feito'>();
  const ordem: Instancia[] = [];
  const visitar = (inst: Instancia) => {
    const e = estado.get(inst.m.codigo);
    if (e === 'feito') return;
    if (e === 'visitando') throw new Error(`gerarObra: ciclo de precedência em ${inst.m.codigo}`);
    estado.set(inst.m.codigo, 'visitando');
    for (const p of inst.m.predecessoras) {
      const pi = porCodigo.get(p);
      if (pi) visitar(pi);
    }
    estado.set(inst.m.codigo, 'feito');
    ordem.push(inst);
  };
  insts.forEach(visitar);

  for (const inst of ordem) {
    const fm = new Map<string, ISODate>();
    const im = new Map<string, ISODate>();
    fins.set(inst.m.codigo, fm);
    inicios.set(inst.m.codigo, im);
    const ehObra = inst.locs.length === 1 && inst.locs[0].id === localObra.id;
    inst.locs.forEach((loc, idx) => {
      const restricoes: ISODate[] = [];
      let resolvido = false;
      const presentes = inst.m.predecessoras.filter((p) => porCodigo.has(p));
      for (const p of presentes) {
        const pi = porCodigo.get(p)!;
        const predObra = pi.locs.length === 1 && pi.locs[0].id === localObra.id;
        let f: ISODate | undefined;
        if (predObra || ehObra) f = maxFim(p);
        else f = fins.get(p)?.get(loc.id); // mesmo local
        if (f) { restricoes.push(f); resolvido = true; }
      }
      // Predecessoras por local que não existem neste local: espera todas terminarem (evita começar no dia 0).
      if (!resolvido) for (const p of presentes) { const f = maxFim(p); if (f) restricoes.push(f); }
      // Linha de balanço: mesma atividade no local anterior.
      if (idx > 0) restricoes.push(fm.get(inst.locs[idx - 1].id)!);
      let ini = inicioObra;
      if (restricoes.length) {
        const ultimo = restricoes.reduce((a, b) => (a > b ? a : b));
        const depois = addDiasUteis(ultimo, 1);
        if (depois > ini) ini = depois;
      }
      im.set(loc.id, ini);
      fm.set(loc.id, addDiasUteis(ini, Math.max(1, inst.m.duracaoDiasUteis) - 1));
    });
  }

  // 3) Valores: orçamento -> etapa (distribuição padrão) -> atividade (peso) -> local (igual)
  const etapasCod = [...modelo.etapasAtivas].sort((a, b) => a - b).filter((c) => insts.some((i) => i.m.etapaCodigo === c));
  const valoresEtapa = ratear(params.orcamentoTotal, etapasCod.map((c) => modelo.distribuicaoPadrao[c] ?? 0));
  const etapas: EtapaObra[] = etapasCod.map((codigo, ei) => {
    const daEtapa = insts.filter((i) => i.m.etapaCodigo === codigo);
    const valoresAtiv = ratear(valoresEtapa[ei], daEtapa.map((i) => i.m.pesoNaEtapa));
    const atividades: Atividade[] = daEtapa.map((inst, ai) => {
      const valoresItem = ratear(valoresAtiv[ai], inst.locs.map(() => 1));
      const itens: ItemAtividade[] = inst.locs.map((loc, li) => ({
        id: `${id}-${inst.m.codigo}-${loc.ordem}`,
        localId: loc.id,
        inicioPlanejado: inicios.get(inst.m.codigo)!.get(loc.id)!,
        fimPlanejado: fins.get(inst.m.codigo)!.get(loc.id)!,
        percentual: 0,
        valorOrcado: valoresItem[li],
      }));
      return {
        id: `${id}-A${inst.m.codigo}`,
        codigo: inst.m.codigo,
        nome: inst.m.nome,
        etapaCodigo: codigo,
        duracaoConfirmada: inst.m.duracaoConfirmada,
        itens,
      };
    });
    const nome = ETAPAS_CAIXA.find((e) => e.codigo === codigo)?.nome ?? `Etapa ${codigo}`;
    return { codigo, nome, valorOrcado: valoresEtapa[ei], valorEstimado: true, atividades };
  });

  return {
    id,
    nome: params.nome,
    tipo: params.tipo,
    endereco: params.endereco,
    cidade: params.cidade,
    areaM2: params.areaM2,
    status: 'planejamento',
    dataInicio: params.dataInicio,
    orcamentoTotal: params.orcamentoTotal,
    engenheiroId: params.engenheiroId,
    encarregadoId: params.encarregadoId,
    locais,
    etapas,
    baselines: [],
    apontamentos: [],
    gastos: [],
  };
}

/** Congela baseline (v1 sem justificativa; v2+ exige justificativa). Retorna nova obra (imutável).
 * Obra em 'planejamento' passa para 'em_andamento'. */
export function congelarBaseline(obra: Obra, autorId: string, hoje: ISODate, justificativa?: string): Obra {
  const versao = obra.baselines.length + 1;
  const just = justificativa?.trim();
  if (versao >= 2 && !just) throw new Error('Justificativa obrigatória para replanejar (baseline v2 ou posterior).');
  const itens: Baseline['itens'] = {};
  for (const e of obra.etapas) for (const a of e.atividades) for (const i of a.itens) {
    itens[i.id] = { inicio: i.inicioPlanejado, fim: i.fimPlanejado, valor: i.valorOrcado };
  }
  const baseline: Baseline = { versao, congeladaEm: hoje, autorId, ...(just ? { justificativa: just } : {}), itens };
  return {
    ...obra,
    status: obra.status === 'planejamento' ? 'em_andamento' : obra.status,
    baselines: [...obra.baselines, baseline],
  };
}

/**
 * (Adicionado pela Fundação) Define o valor de uma etapa (marca valorEstimado = false) e redistribui
 * proporcionalmente entre as atividades e itens dela. Com manterTotal (padrão), as demais etapas são
 * reescaladas para o orçamento total continuar igual; sem, o orçamento total passa a ser a soma das etapas.
 */
export function ajustarValorEtapa(obra: Obra, codigo: number, novoValor: number, manterTotal = true): Obra {
  const etapas: EtapaObra[] = JSON.parse(JSON.stringify(obra.etapas));
  const alvo = etapas.find((e) => e.codigo === codigo);
  if (!alvo) throw new Error(`ajustarValorEtapa: etapa ${codigo} não existe na obra`);
  const valor = Math.max(0, Math.round(novoValor * 100) / 100);
  const redistribuir = (e: EtapaObra, v: number) => {
    e.valorOrcado = v;
    const vAtiv = ratear(v, e.atividades.map((a) => a.itens.reduce((s, i) => s + i.valorOrcado, 0)));
    e.atividades.forEach((a, ai) => {
      const vItens = ratear(vAtiv[ai], a.itens.map((i) => i.valorOrcado));
      a.itens.forEach((i, ii) => { i.valorOrcado = vItens[ii]; });
    });
  };
  redistribuir(alvo, valor);
  alvo.valorEstimado = false;
  let orcamentoTotal = obra.orcamentoTotal;
  if (manterTotal) {
    const outras = etapas.filter((e) => e !== alvo);
    const restante = Math.max(0, obra.orcamentoTotal - valor);
    const novos = ratear(restante, outras.map((e) => e.valorOrcado));
    outras.forEach((e, i) => redistribuir(e, novos[i]));
  } else {
    orcamentoTotal = Math.round(etapas.reduce((s, e) => s + e.valorOrcado, 0) * 100) / 100;
  }
  return { ...obra, orcamentoTotal, etapas };
}

export type { Baseline };
