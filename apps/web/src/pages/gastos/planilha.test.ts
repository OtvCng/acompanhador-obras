import { describe, expect, it } from 'vitest';
import { celulaParaTexto, detectarSeparador, lerCsv, matrizParaLinhas, montarCsvModelo, normalizarColuna } from './planilha';
import { textoParaCentavos, formatarCentavos } from './EntradaReais';

describe('planilha de gastos', () => {
  it('detecta ; e ,', () => {
    expect(detectarSeparador('data;etapa;valor\n')).toBe(';');
    expect(detectarSeparador('data,etapa,valor\n')).toBe(',');
    // vírgula dentro de aspas não conta
    expect(detectarSeparador('"a,b,c";x;y')).toBe(';');
  });

  it('lê CSV com BOM, CRLF, aspas e vírgula decimal', () => {
    const m = lerCsv('﻿data;valor;descricao\r\n05/11/2026;1.234,56;"Cimento; 50 sacos"\r\n06/11/2026;10;"Diz ""ok"""\r\n');
    expect(m).toEqual([
      ['data', 'valor', 'descricao'],
      ['05/11/2026', '1.234,56', 'Cimento; 50 sacos'],
      ['06/11/2026', '10', 'Diz "ok"'],
    ]);
  });

  it('CSV separado por vírgula com valor entre aspas', () => {
    expect(lerCsv('data,valor\n2026-11-05,"1.234,56"')).toEqual([
      ['data', 'valor'],
      ['2026-11-05', '1.234,56'],
    ]);
  });

  it('normaliza cabeçalho e numera linhas como na planilha', () => {
    expect(normalizarColuna(' Descrição  ')).toBe('descricao');
    const r = matrizParaLinhas([
      ['Data', 'Etapa', 'Descrição'],
      ['05/11/2026', '3', 'Aço'],
      ['', '', ''],
      ['06/11/2026', 'Supraestrutura', 'Forma'],
    ]);
    expect(r.colunas).toEqual(['data', 'etapa', 'descricao']);
    expect(r.linhas.map((l) => l.numero)).toEqual([2, 4]);
    expect(r.linhas[1].dados).toEqual({ data: '06/11/2026', etapa: 'Supraestrutura', descricao: 'Forma' });
  });

  it('converte células do XLSX', () => {
    expect(celulaParaTexto(new Date(Date.UTC(2026, 10, 5)))).toBe('05/11/2026');
    expect(celulaParaTexto(1234.5)).toBe('1234,5');
    expect(celulaParaTexto(0.1 + 0.2)).toBe('0,3');
    expect(celulaParaTexto(null)).toBe('');
  });

  it('modelo CSV com BOM e aspas quando precisa', () => {
    const csv = montarCsvModelo(['data', 'descricao'], [['05/11/2026', 'Areia; média']]);
    expect(csv.startsWith('﻿data;descricao\r\n')).toBe(true);
    expect(csv).toContain('"Areia; média"');
    expect(lerCsv(csv)[1]).toEqual(['05/11/2026', 'Areia; média']);
  });
});

describe('máscara de R$', () => {
  it('dígitos entram pela direita', () => {
    expect(textoParaCentavos('1')).toBe(1);
    expect(textoParaCentavos('R$ 1.234,56')).toBe(123456);
    expect(textoParaCentavos('0,00')).toBe(0);
    expect(formatarCentavos(123456)).toBe('1.234,56');
  });
});
