/** "Pular para o conteúdo": primeiro elemento focável da página. */
export function SkipLink({ href = "#conteudo" }: { href?: string }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-sm"
    >
      Pular para o conteúdo
    </a>
  );
}
