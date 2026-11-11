/**
 * Leitura de planilhas de gastos no navegador (CSV e XLSX) e modelo para baixar.
 * Aqui só se transforma o arquivo em linhas de texto { coluna: valor }; quem valida é
 * validarLinhasGasto (shared), o mesmo que a API usa ao gravar.
 */

/** Normaliza o nome da coluna: minúsculas, sem acento, sem espaços extras ("Descrição " -> "descricao"). */
export function normalizarColuna(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Detecta o separador pela primeira linha: o que aparecer mais entre ';' e ',' fora de aspas. */
export function detectarSeparador(texto: string): ';' | ',' {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? '';
  let pv = 0;
  let v = 0;
  let aspas = false;
  for (const c of primeira) {
    if (c === '"') aspas = !aspas;
    else if (!aspas && c === ';') pv++;
    else if (!aspas && c === ',') v++;
  }
  return pv >= v && pv > 0 ? ';' : v > 0 ? ',' : ';';
}

/** CSV (RFC 4180 + separador ';' ou ',') -> matriz de células. Aceita BOM, CRLF e aspas com "" escapado. */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '');
  const sep = detectarSeparador(t);
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = '';
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          celula += '"';
          i++;
        } else aspas = false;
      } else celula += c;
    } else if (c === '"' && celula === '') aspas = true;
    else if (c === sep) {
      linha.push(celula);
      celula = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(celula);
      linhas.push(linha);
      linha = [];
      celula = '';
    } else celula += c;
  }
  if (celula !== '' || linha.length) {
    linha.push(celula);
    linhas.push(linha);
  }
  return linhas;
}

/** Matriz (1ª linha = cabeçalho) -> objetos com as colunas normalizadas. Ignora linhas totalmente vazias. */
export function matrizParaLinhas(matriz: string[][]): { colunas: string[]; linhas: { numero: number; dados: Record<string, string> }[] } {
  const [cab = [], ...resto] = matriz;
  const colunas = cab.map(normalizarColuna);
  const linhas: { numero: number; dados: Record<string, string> }[] = [];
  resto.forEach((cel, i) => {
    if (cel.every((c) => c.trim() === '')) return;
    const dados: Record<string, string> = {};
    colunas.forEach((col, j) => {
      if (col) dados[col] = (cel[j] ?? '').trim();
    });
    // número da linha como o usuário vê na planilha (cabeçalho = linha 1)
    linhas.push({ numero: i + 2, dados });
  });
  return { colunas, linhas };
}

const dois = (n: number) => String(n).padStart(2, '0');

/** Célula do XLSX -> texto no formato que a validação entende (data dd/mm/aaaa, número com vírgula decimal). */
export function celulaParaTexto(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    // O XLSX guarda datas sem fuso; a lib devolve meia-noite UTC.
    return `${dois(v.getUTCDate())}/${dois(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    // Sem separador de milhar e com vírgula decimal: "1234,5" não é ambíguo como "1.234".
    return String(Math.round(v * 100) / 100).replace('.', ',');
  }
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  return String(v);
}

export type ArquivoLido = { colunas: string[]; linhas: { numero: number; dados: Record<string, string> }[] };

export const TAMANHO_MAXIMO_ARQUIVO = 5 * 1024 * 1024;
export const LINHAS_MAXIMAS = 2000;

/** Lê um arquivo .csv ou .xlsx escolhido pelo usuário. Lança Error com mensagem para a tela. */
export async function lerArquivoPlanilha(arquivo: File): Promise<ArquivoLido> {
  const nome = arquivo.name.toLowerCase();
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) throw new Error('Arquivo maior que 5 MB. Divida a planilha em partes menores.');
  let matriz: string[][];
  if (nome.endsWith('.csv') || nome.endsWith('.txt') || arquivo.type === 'text/csv') {
    matriz = lerCsv(await lerTexto(arquivo));
  } else if (nome.endsWith('.xlsx')) {
    // Carregada só quando alguém importa XLSX, para não pesar no app do canteiro.
    const { readSheet } = await import('read-excel-file/browser');
    let dados: unknown[][];
    try {
      dados = (await readSheet(arquivo)) as unknown[][];
    } catch {
      throw new Error('Não foi possível ler o arquivo XLSX. Confira se ele não está protegido por senha ou corrompido.');
    }
    matriz = dados.map((linha) => linha.map(celulaParaTexto));
  } else if (nome.endsWith('.xls')) {
    throw new Error('Formato .xls (Excel antigo) não é aceito. No Excel, use "Salvar como" .xlsx ou .csv.');
  } else {
    throw new Error('Escolha um arquivo .csv ou .xlsx.');
  }
  const r = matrizParaLinhas(matriz);
  if (r.colunas.length === 0 || r.colunas.every((c) => !c)) throw new Error('A planilha está vazia ou sem cabeçalho na primeira linha.');
  if (r.linhas.length === 0) throw new Error('A planilha só tem o cabeçalho. Preencha ao menos uma linha de gasto.');
  if (r.linhas.length > LINHAS_MAXIMAS) throw new Error(`A planilha tem ${r.linhas.length} linhas; o limite é ${LINHAS_MAXIMAS} por importação.`);
  return r;
}

/** Texto do CSV: tenta UTF-8; se aparecer caractere inválido (CSV salvo pelo Excel em ANSI), relê como Windows-1252. */
async function lerTexto(arquivo: File): Promise<string> {
  const buf = await arquivo.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('�')) return utf8;
  return new TextDecoder('windows-1252').decode(buf);
}

const csvCelula = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** CSV modelo (separador ';', padrão do Excel em pt-BR) com BOM para abrir com acento certo. */
export function montarCsvModelo(colunas: string[], exemplos: string[][]): string {
  return '﻿' + [colunas, ...exemplos].map((l) => l.map(csvCelula).join(';')).join('\r\n') + '\r\n';
}

/** Dispara o download de um texto como arquivo. */
export function baixarTexto(nomeArquivo: string, conteudo: string, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
