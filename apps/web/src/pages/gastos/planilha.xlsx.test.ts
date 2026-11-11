// @ts-nocheck: teste roda no Vitest (Node) e usa createRequire/require; o tsconfig do web não carrega tipos de Node.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { lerArquivoPlanilha } from './planilha';
const req = createRequire(require.resolve('read-excel-file/package.json'));
const { zipSync, strToU8 } = req('fflate');
const x = (s: string) => strToU8(s);
const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="inlineStr"><is><t>Data</t></is></c><c r="B1" t="inlineStr"><is><t>Etapa</t></is></c><c r="C1" t="inlineStr"><is><t>Valor</t></is></c><c r="D1" t="inlineStr"><is><t>Descrição</t></is></c></row>
<row r="2"><c r="A2" s="1"><v>46331</v></c><c r="B2"><v>3</v></c><c r="C2"><v>1234.5</v></c><c r="D2" t="inlineStr"><is><t>Aço</t></is></c></row>
</sheetData></worksheet>`;
const files = {
  '[Content_Types].xml': x(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
  '_rels/.rels': x(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
  'xl/workbook.xml': x(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Gastos" sheetId="1" r:id="rId1"/></sheets></workbook>`),
  'xl/_rels/workbook.xml.rels': x(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
  'xl/styles.xml': x(`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>`),
  'xl/worksheets/sheet1.xml': x(sheet),
};
describe('leitura de XLSX (arquivo montado em memória)', () => {
  it('converte data serial e número para o texto que a validação entende', async () => {
    const buf = zipSync(files);
    const r = await lerArquivoPlanilha(new File([buf], 'g.xlsx'));
    
    expect(r.linhas[0].dados).toEqual({ data: '05/11/2026', etapa: '3', valor: '1234,5', descricao: 'Aço' });
  });
});
