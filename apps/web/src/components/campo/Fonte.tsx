import { ExternalLink } from 'lucide-react';

const URL_RE = /https?:\/\/[^\s)]+/g;

/** Separa o texto da fonte das URLs que ele contém (o campo `fonte` do shared mistura os dois). */
export function separarFonte(fonte: string): { texto: string; urls: string[] } {
  const urls = [...new Set(fonte.match(URL_RE) ?? [])];
  const texto = fonte
    .replace(/\s*\(\s*https?:\/\/[^\s)]+\s*\)/g, '')
    .replace(URL_RE, '')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { texto, urls };
}

function dominio(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
}

/** Texto curto da fonte + ícone de link externo para cada URL. */
export default function Fonte({ fonte }: { fonte?: string }) {
  if (!fonte) return <span className="text-muted">sem fonte</span>;
  const { texto, urls } = separarFonte(fonte);
  return (
    <span className="flex items-start gap-1.5">
      <span className="line-clamp-2" title={texto}>
        {texto || dominio(urls[0] ?? '')}
      </span>
      {urls.map((u) => (
        <a
          key={u}
          href={u}
          target="_blank"
          rel="noopener noreferrer"
          className="-m-1 inline-flex shrink-0 items-center rounded p-1 text-accent hover:bg-accent/10"
          aria-label={`Abrir fonte em ${dominio(u)} (nova aba)`}
          title={u}
        >
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      ))}
    </span>
  );
}
