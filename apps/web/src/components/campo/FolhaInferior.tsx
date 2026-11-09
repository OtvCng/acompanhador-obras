import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

/** Folha inferior (bottom sheet) para celular; em telas largas vira um painel centralizado. */
export default function FolhaInferior({
  aberta,
  aoMudar,
  titulo,
  subtitulo,
  children,
  rodape,
}: {
  aberta: boolean;
  aoMudar: (v: boolean) => void;
  titulo: string;
  subtitulo?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <Dialog.Root open={aberta} onOpenChange={aoMudar}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl bg-surface shadow-2xl outline-none data-[state=open]:animate-[sobe_200ms_ease-out] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
          aria-describedby={undefined}
        >
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-gray-300 sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold leading-snug text-gray-900">{titulo}</Dialog.Title>
              {subtitulo && <div className="mt-0.5 text-sm text-muted">{subtitulo}</div>}
            </div>
            <Dialog.Close className="-mr-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-gray-100" aria-label="Fechar">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
          {rodape && <div className="border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{rodape}</div>}
        </Dialog.Content>
      </Dialog.Portal>
      <style>{`@keyframes sobe{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes fade-in{from{opacity:0}to{opacity:1}}@media (min-width:640px){@keyframes sobe{from{opacity:0}to{opacity:1}}}`}</style>
    </Dialog.Root>
  );
}
